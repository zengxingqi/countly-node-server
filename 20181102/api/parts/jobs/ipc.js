'use strict';

var EventEmitter = require('events'),
    cluster = require('cluster'),
    log = require('../../utils/log.js')('jobs:ipc');

var CMD = {
    RUN: 'job:run',
    ABORT: 'job:abort',
    PAUSE: 'job:pause',
    STATUS: 'job:status',
    CRASH: 'job:crash'
};

/**
Common message structures: 
{
    _id: 'job id',
    cmd: 'job:run',
    from: 1238,     from pid
    to: 3820,       to pid
    
    ... other job fields
}

{
    _id: 'job id',
    cmd: 'job:status',
    from: 1238,     from pid
    to: 3820,       to pid

    status: 1,
    part: 0.5,
    bookmark: 'some progress bookmark',
    ... other job fields
}
*/

/**
 * Just a set classes that incapsulate IPC stuff and pass through only messages for specific _id (IdChannel) 
 * or with some pid (PidFromChannel / PidToChannel).
 */

/** Class encapsulating channel **/
class Channel extends EventEmitter {
    /**
    * Constructor accepting check function
    * @param {function} check - to check/filter message for specific channel
    **/
    constructor(check) {
        super();
        this.check = check;
    }

    /**
    * Add worker
    * @param {object} worker - worker to add to channel
    * @returns {object} self
    **/
    attach(worker) {
        this.worker = worker || process;
        this.onMessageListener = (m) => {
            // log.d('[%d]: Got message in Channel in %d: %j', process.pid, this.worker.pid, m, this._id);
            if (this.check(m)) {
                // log.d('[%d]: Channeling %j', process.pid, m);
                this.emit(m.cmd, m.data);
            }
        };
        this.worker.setMaxListeners(this.worker.getMaxListeners() + 1);
        this.worker.on('message', this.onMessageListener);
        this.worker.on('exit', this.emit.bind(this, 'exit'));
        this.worker.on('error', this.emit.bind(this, 'crash'));
        return this;
    }

    /**
    * Removing worker from channel
    **/
    remove() {
        log.d('[%d]: Removing Channel for %s', process.pid, this._id);
        try {
            if (this.onMessageListener) {
                this.worker.removeListener('message', this.onMessageListener);
                this.worker.setMaxListeners(this.worker.getMaxListeners() - 1);
                this.onMessageListener = undefined;
            }
        }
        catch (e) {
            console.log('+++++++++++++++++++++++++++++', e);
        }
    }

    /**
    * Send message to this channel
    * @param {string} _id - id of channel
    * @param {object} cmd - command
    * @param {object} data - additional data
    **/
    send(_id, cmd, data) {
        // log.d('Sending message from Channel in %d: %j', process.pid, {_id: _id, cmd: cmd, from: process.pid, to: this.worker.pid, data: data});
        this.worker.send({
            _id: _id,
            cmd: cmd,
            from: process.pid,
            to: this.worker.pid,
            data: data
        });
    }
}

/** Class for channel by id **/
class IdChannel extends Channel {
    /**
    * Constructor accepting id of channel
    * @param {string} _id - id of channel
    **/
    constructor(_id) {
        super(m => m._id === _id);
        this._id = _id;
        log.d('Started IdChannel in %d', process.pid, _id);
    }

    /**
    * Send message to this channel
    * @param {object} cmd - command
    * @param {object} data - additional data
    **/
    send(cmd, data) {
        this.worker.send({
            _id: this._id,
            cmd: cmd,
            from: process.pid,
            to: this.worker.pid,
            data: data
        });
    }
}

/** Class for channel by start with id (sub channels) **/
class IdStartsWithChannel extends Channel {
    /**
    * Constructor accepting id of channel
    * @param {string} _id - id of channel
    **/
    constructor(_id) {
        super(m => m._id.indexOf(_id) === 0);
        log.d('Started IdStartsWithChannel in %d', process.pid, _id);
    }
}



/** Countly master process, just pass through messages to specific pid in `to` field of message */
class PassThrough {
    /** Constructor */
    constructor() {
        log.i('Started PassThrough in %d', process.pid);
        this.workers = {}; // map of pid: worker
    }

    /**
    * Start passing messages
    * @param {object} jobsWorker - job
    **/
    start(jobsWorker) {
        this.jobsWorker = jobsWorker;
        this.jobsWorker.on('message', this.pass.bind(this));

        cluster.on('online', (worker) => {
            log.i('Worker started: %d', worker.process.pid);
            this.workers[worker.process.pid] = worker;
            worker.on('message', (m) => {
                this.pass(m);
            });
        });

        cluster.on('exit', (worker) => {
            if (worker.process.pid in this.workers) {
                log.e('Worker crashed: %d', worker.process.pid);
                delete this.workers[worker.process.pid];
                jobsWorker.send({
                    cmd: CMD.CRASH,
                    from: worker.process.pid,
                    to: jobsWorker.pid
                });
            }
        });

        process.on('uncaughtException', (err) => {
            log.e('uncaughtException on process %d', process.pid, err.stack);
        });

        log.i('Attached to cluster in PassThrough %d', process.pid);
    }

    /**
    * Pass message
    * @param {object} m - message
    **/
    pass(m) {
        log.d('Got message in PassThrough: %j', m);
        if (m.to && m.to in this.workers) {
            log.d('Passing through message from %j to %j', m.from, m.to);
            this.workers[m.to].send(m);
        }
        else if (m.to && m.to === this.jobsWorker.pid) {
            log.d('Passing through message from %j to jobs %j', m.from, m.to);
            this.jobsWorker.send(m);
        }
        else if (!m.to && m.from) {
            let pids = Object.keys(this.workers);
            var idx = Math.floor(Math.random() * pids.length);
            m.to = pids[idx];
            log.d('Passing through message from %d to randomly selected %d (out of %d)', m.from, m.to, pids.length);
            this.workers[m.to].send(m);
        }
    }
}

module.exports.PassThrough = PassThrough;
module.exports.IdChannel = IdChannel;
module.exports.IdStartsWithChannel = IdStartsWithChannel;