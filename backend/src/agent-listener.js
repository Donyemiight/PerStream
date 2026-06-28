/**
 * PerStream AI Listener Agent
 *
 * An autonomous agent that:
 *   1. Has its own USDC wallet (mock or real)
 *   2. Has a daily budget (e.g. $5)
 *   3. Discovers tracks on PerStream
 *   4. Pays per-second to listen
 *   5. Stops when budget exhausted
 *   6. Logs what it consumed
 *
 * This is the "AI agent as economic actor" the Lepton brief explicitly asks for.
 * The agent doesn't need a human — it operates 24/7 with its own wallet,
 * discovering content, paying for it, and producing a consumption record.
 *
 * Run modes:
 *   - node src/agent-listener.js            (interactive: prints activity)
 *   - API:  POST /api/agent/listen          (kicks off agent for one track)
 *   - API:  POST /api/agent/auto            (runs agent in autonomous mode)
 *
 * Settlement: uses the same x402 + Nanopayments flow as a human listener.
 */

const db = require('./db');
const arc = require('./arc');
const wallet = require('./wallet');

class ListenerAgent {
  /**
   * @param {object} opts
   * @param {string} opts.email       Agent's email (used to provision its wallet)
   * @param {string} opts.handle      Agent's handle
   * @param {number} opts.budgetUsd   Total budget in USDC (default $5)
   * @param {string} opts.goal        What the agent is trying to accomplish
   */
  constructor({ email, handle, budgetUsd = 5, goal = 'discover and consume paid audio' }) {
    this.email = email || `agent-${Date.now()}@perstream.fm`;
    this.handle = handle || `agent-${Math.random().toString(36).slice(2, 8)}`;
    this.budgetUsd = budgetUsd;
    this.budgetMicroUsdc = arc.usdToMicro(budgetUsd);
    this.goal = goal;
    this._log = [];
  }

  /** Initialize the agent: provision wallet, deposit budget. */
  async init() {
    // Find or create the agent user
    let user = db.getUserByEmail(this.email);
    if (!user) {
      const prov = await wallet.provisionWallet({ email: this.email, handle: this.handle });
      user = db.createUser({
        handle: this.handle,
        email: this.email,
        wallet: prov.wallet,
        role: 'agent',
      });
      this.log(`Created agent wallet: ${prov.wallet}`);
    } else {
      this.log(`Reusing existing agent wallet: ${user.wallet}`);
    }
    this.user = user;

    // Deposit the budget
    if (arc.MODE === 'mock') {
      await arc.deposit({ listener: this.user.wallet, amountMicroUsdc: this.budgetMicroUsdc });
      this.log(`Deposited budget: $${this.budgetUsd} USDC`);
    } else {
      // Live mode: user must fund their wallet before agent can run
      this.log(`[live mode] Make sure wallet ${this.user.wallet} has at least $${this.budgetUsd} USDC`);
    }

    return this;
  }

  /** Pick a track to listen to (autonomous decision). */
  pickTrack() {
    const tracks = db.listTracks();
    if (!tracks.length) {
      throw new Error('No tracks available. Seed first.');
    }
    // Simple strategy: pick the shortest, cheapest track
    return tracks.sort((a, b) => a.price_per_sec - b.price_per_sec)[0];
  }

  /** Listen to a single track, paying per second, until budget runs out or track ends. */
  async listenToTrack(trackId, { maxSeconds = null } = {}) {
    const track = db.getTrack(trackId);
    if (!track) throw new Error(`Track ${trackId} not found`);

    const creator = db.getUser(track.creator_id);
    const session = db.openSession({
      trackId: track.id,
      listenerId: this.user.id,
      creatorId: creator.id,
      pricePerSec: track.price_per_sec,
    });

    this.log(`🎧 Started listening: "${track.title}" (session ${session.id})`);
    this.log(`   Creator wallet: ${creator.wallet}`);
    this.log(`   Price: ${arc.microToUsd(track.price_per_sec)} USDC/sec`);

    let secondsPlayed = 0;
    const limit = maxSeconds || track.duration_sec || Infinity;

    // Tick once per second, paying per second
    while (secondsPlayed < limit) {
      const balance = arc.getListenerBalance(this.user.wallet);
      if (balance < track.price_per_sec) {
        this.log(`💸 Budget exhausted after ${secondsPlayed}s. Agent stops.`);
        break;
      }

      const result = await arc.tick({
        sessionId: session.id,
        listener: this.user.wallet,
        creator: creator.wallet,
        pricePerSec: track.price_per_sec,
        seconds: 1,
      });

      if (!result.ok) {
        this.log(`❌ Tick failed: ${result.reason}`);
        break;
      }

      db.tickSession(session.id, track.price_per_sec);
      db.incrementTrackStats(track.id, track.price_per_sec);
      secondsPlayed++;

      if (secondsPlayed % 5 === 0) {
        const totalPaid = arc.microToUsd(track.price_per_sec * secondsPlayed);
        this.log(`   ... ${secondsPlayed}s played, $${totalPaid.toFixed(6)} paid to creator`);
      }

      // Wait 1 second (real time) before next tick
      await new Promise(r => setTimeout(r, 1000));
    }

    db.closeSession(session.id);

    const totalPaidUsd = arc.microToUsd(track.price_per_sec * secondsPlayed);
    const remainingBalance = await arc.getListenerBalance(this.user.wallet);
    this.log(`✅ Session complete: ${secondsPlayed}s, $${totalPaidUsd.toFixed(6)} paid, $${arc.microToUsd(remainingBalance).toFixed(6)} remaining`);

    return {
      trackId: track.id,
      secondsPlayed,
      totalPaidUsd,
      remainingBalanceUsd: arc.microToUsd(remainingBalance),
    };
  }

  /** Run the agent autonomously: discover, decide, listen, repeat until budget runs out. */
  async runAutonomous({ maxTracks = 3 } = {}) {
    this.log(`🤖 Starting autonomous run: budget=$${this.budgetUsd}, maxTracks=${maxTracks}, goal="${this.goal}"`);

    const sessions = [];
    let tracksListened = 0;

    while (tracksListened < maxTracks) {
      const balance = arc.getListenerBalance(this.user.wallet);
      if (balance < 100) {  // Less than 0.0001 USDC
        this.log(`💸 Budget too low to continue ($${arc.microToUsd(balance).toFixed(6)} remaining). Stopping.`);
        break;
      }

      const track = this.pickTrack();
      this.log(`\n📡 Discovery: picked track "${track.title}"`);

      const result = await this.listenToTrack(track.id, { maxSeconds: 30 });
      sessions.push(result);
      tracksListened++;
    }

    const totalSpent = this.budgetMicroUsdc - arc.getListenerBalance(this.user.wallet);
    const totalSpentUsd = arc.microToUsd(totalSpent);

    this.log(`\n🎯 Autonomous run complete`);
    this.log(`   Tracks consumed: ${sessions.length}`);
    this.log(`   Total spent: $${totalSpentUsd.toFixed(6)} USDC`);
    this.log(`   Remaining: $${arc.microToUsd(arc.getListenerBalance(this.user.wallet)).toFixed(6)} USDC`);

    return {
      agent: this.user,
      sessions,
      totalSpentUsd,
      remainingUsd: arc.microToUsd(arc.getListenerBalance(this.user.wallet)),
      log: this._log,
    };
  }

  log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this._log.push(line);
    console.log(line);
  }
}

module.exports = ListenerAgent;

// CLI usage: `node src/agent-listener.js`
if (require.main === module) {
  (async () => {
    await db.ready();
    const agent = new ListenerAgent({
      email: 'autonomous-agent@perstream.fm',
      handle: 'autonomous-agent',
      budgetUsd: 5,
      goal: 'Discover and consume paid podcasts autonomously',
    });
    await agent.init();
    await agent.runAutonomous({ maxTracks: 3 });
    process.exit(0);
  })().catch(err => {
    console.error('[agent] fatal:', err);
    process.exit(1);
  });
}