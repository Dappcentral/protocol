const IPFS = require("ipfs");
const OrbitDb = require("orbit-db");

module.exports = class Decentralizer {
  // use contractor class to define the config values
  constructor(config = {}) {
    this.config = {
      ...config,
      ipfsOptions: {
        EXPIREMENTAL: {
          // OrbitDb relies on IPFS pub/sub for p2p connections
          pubsub: true,
        },
        ...config.ipfsOptions,
      },
      orbitDbOptions: {
        // this is our default log database
        LOG_DATABASE: "imbrexer-logs",
        ...config.orbitdbOptions,
      },
    };
  }

  // define an async method for initializing IPFS and OrbitDb
  async initialize() {
    // create the ipfs instance
    this._ipfs = new IPFS(this.config.ipfsOptions);

    return new Promise((res, rej) => {
      // reject on errors
      this._ipfs.on("error", rej);

      // setup OrbitDb after IPFS
      this._ipfs.on("ready", async () => {
        try {
          // create the orbitDb instance
          this._orbitDb = new OrbitDb(this._ipfs);

          // define the specific logDb
          this._logDb = await this._orbitDb.log(
            this.config.orbitDbOptions.LOG_DATABASE,
          );

          // load the logDb so we have it
          await this._logDb.load();

          // resolve the initialize promise
          res(true);
        } catch (err) {
          // if any of the above fails, reject the promise
          rej(err);
        }
      });
    });
  }

  // method to store data via ipfs
  async addData(data) {
    if (!data || typeof data !== "string") {
      // make sure we're saving something valid
      return false;
    }

    // convert stringified data to buffer
    const content = this._ipfs.types.Buffer.from(data);

    // add content and return hash
    const [{ hash }] = await this._ipfs.files.add(content);
    return hash;
  }

  // method to retrieve data from ipfs
  async retrieveData(hash) {
    if (!hash) {
      // make sure we're given a hash
      return false;
    }

    // fetch the data from ipfs
    return this._ipfs.files.cat(hash);
  }

  // method to add logs
  async addLog(id, hash, meta = {}) {
    if (!id || !hash) {
      // make sure we have something to log
      return false;
    }

    // wait for the log to be added
    await this._logDb.add({ id, hash, meta });
    return true;
  }

  // method to retrieve logs
  async retrieveLogs(opts = {}) {
    const logs = this._logDb.iterator(opts).collect();
    return logs.map(l => l.payload.value);
  }
};