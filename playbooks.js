let request = require('request');
let moment = require('moment');
let async = require('async');
let fp = require('lodash/fp');
const NodeCache = require('node-cache');

const playbooksCache = new NodeCache({
  stdTTL: 2 * 60
});

let ro = require('./request-options');
let errorHandler = require('./error-handler');

const NUM_PLAYBOOKS_TO_DISPLAY = 100;

class Playbooks {
  constructor(logger, options) {
    this.options = options;
    this.logger = logger;
    this.requestWithDefaults = errorHandler(request.defaults(ro.getRequestOptions(this.options)));
    this.playbookRuns = [];
    this.playbookNames = [];
    this.playbookLabels = fp.flow(fp.split(','), fp.map(fp.trim), fp.sortedUniq)(options.playbookLabels);
  }

  listPlaybooks(callback) {
    const playbookLabelsStr = this.playbookLabels.toString()
    const playbooks = playbooksCache.get(playbookLabelsStr);

    if (playbooks) 
      return callback(null, playbooks);

    async.parallel(
      fp.map(
        (playbookLabel) => (done) => {
          this.requestWithDefaults(
            {
              url: `${this.options.host}/rest/playbook`,
              qs: {
                _filter_labels__contains: `'${playbookLabel || 'events'}'`,
                _exclude_category: "'deprecated'"
              },
              method: 'GET'
            },
            200,
            (err, body) => {
              if (err) return done({ err, detail: 'Error in getting List of Playbooks to Run' });
              done(null, body.data);
            }
          );
        }
      )(this.playbookLabels),
      (err, results) => {
        if (err) {
          Logger.error({ err: err }, 'Error in onDetails lookup');
          return callback(err);
        }

        const playbooks = fp.flow(fp.flatten, fp.uniqBy('id'))(results);
        playbooksCache.set(playbookLabelsStr, playbooks);
        callback(null, playbooks);
      }
    );
  }

  getPlaybookRunHistory(containerIds, callback) {
    const containerHasBeenRequested = (containerId) =>
      !!this.playbookRuns.find((playbookRun) => playbookRun.containerId === containerId);

    async.each(
      containerIds,
      (containerId, next) => {
        if (containerHasBeenRequested(containerId)) return next();

        let requestOptions = {};
        requestOptions.url = this.options.host + '/rest/playbook_run';
        requestOptions.qs = {
          _filter_container: this.safeToInt(containerId),
          page_size: 1000,
          page: 0
        };
        requestOptions.json = true;

        this.logger.trace({ options: requestOptions }, 'Request options for Historical Playbook Runs Request');

        this.requestWithDefaults(requestOptions, 200, (err, body) => {
          if (err) {
            this.logger.error({ error: err, body }, 'Got error while trying to run playbook');
            return next(err);
          }

          this.logger.trace({ body }, 'Formatting Playbooks Ran Request Results');

          const playbooksRanWithUnknowns = this.formatPlaybookRuns(body);

          this.getUnknownPlaybookNames(playbooksRanWithUnknowns, (err, playbooksRan) => {
            if (err) return next(err);
            this.playbookRuns.push({
              containerId,
              playbooksRanCount: playbooksRan.length,
              playbooksRan: playbooksRan.slice(0, NUM_PLAYBOOKS_TO_DISPLAY)
            });
            next();
          });
        });
      },
      (err) =>
        callback(
          err,
          this.playbookRuns.filter(({ containerId }) => containerIds.includes(containerId))
        )
    );
  }

  getDistinctPlaybookRuns(agg, playbookRun) {
    const existingPlaybookRunIndex = agg.findIndex(({ playbookName }) => playbookName === playbookRun.playbookName);

    const aggAndReplaceExistingPlaybookRun = () => [
      ...agg.slice(0, existingPlaybookRunIndex),
      {
        ...agg[existingPlaybookRunIndex],
        ...(playbookRun.status === 'success'
          ? { successCount: agg[existingPlaybookRunIndex].successCount + 1 }
          : playbookRun.status === 'failure'
          ? { failureCount: agg[existingPlaybookRunIndex].failureCount + 1 }
          : { pendingCount: agg[existingPlaybookRunIndex].pendingCount + 1 })
      },
      ...agg.slice(existingPlaybookRunIndex + 1)
    ];

    const aggNewPlaybookRun = () => [
      ...agg,
      {
        ...playbookRun,
        successCount: 0,
        failureCount: 0,
        pendingCount: 0,
        ...(playbookRun.status === 'success'
          ? { successCount: 1 }
          : playbookRun.status === 'failure'
          ? { failureCount: 1 }
          : { pendingCount: 1 })
      }
    ];

    return existingPlaybookRunIndex !== -1 ? aggAndReplaceExistingPlaybookRun() : aggNewPlaybookRun();
  }

  formatPlaybookRuns(body) {
    return fp.flow(
      fp.get('data'),
      fp.map((playbookRan) => {
        let playbookRunInfo;
        try {
          playbookRunInfo =
            playbookRan.message[0] === '{' ? JSON.parse(playbookRan.message) : {};

          if (!playbookRunInfo.status) this.logger.trace({ message: playbookRan.message });
        } catch (error) {
          this.logger.error(parseError, 'Error Parsing playbook ran message');  
        }

        return {
          playbookId: this.safeToInt(playbookRan.playbook),
          playbookName: fp.flow(fp.getOr('/Unknown', 'playbook'), fp.split('/'), fp.last)(playbookRunInfo),
          status: playbookRan.status || 'failure',
          date: moment(playbookRan.update_time).format('MMM D YY, h:mm A')
        };
      })
    )(body);
  }

  getUnknownPlaybookNames(playbooksRanWithUnknowns, callback) {
    let unknownPlaybooksWithNames = [];
    const [knownPlaybookRuns, unknownPlaybookRuns] = playbooksRanWithUnknowns.reduce(
      (agg, playbookRun) =>
        playbookRun.playbookName === 'Unknown'
          ? [[...agg[0]], [...agg[1], playbookRun]]
          : [[...agg[0], playbookRun], [...agg[1]]],
      [[], []]
    );

    const checkForPlaybookName = (_playbookId) =>
      this.playbookNames.find(({ playbookId }) => playbookId === _playbookId);

    async.each(
      unknownPlaybookRuns,
      (unknownPlaybookRun, next) => {
        const playbookNameFound = checkForPlaybookName(unknownPlaybookRun.playbookId);
        if (playbookNameFound) {
          unknownPlaybooksWithNames.push({ ...unknownPlaybookRun, ...playbookNameFound });
          return next();
        }

        this.getPlaybookName(unknownPlaybookRun.playbookId, (err, playbookId, playbookName) => {
          if (err) return next(err);
          this.playbookNames.push({ playbookId, playbookName });
          unknownPlaybooksWithNames.push({
            ...unknownPlaybookRun,
            playbookName
          });
          next();
        });
      },
      (err) => {
        callback(
          err,
          [...knownPlaybookRuns, ...unknownPlaybooksWithNames].sort((a, b) =>
            moment(new Date(b.date)).diff(moment(new Date(a.date)))
          )
        );
      }
    );
  }

  getPlaybookName(playbookId, callback) {
    let requestOptions = {};
    requestOptions.url = this.options.host + '/rest/playbook/' + playbookId;
    requestOptions.json = true;

    this.logger.trace({ options: requestOptions }, 'Request options for a Playbook Name Request');

    this.requestWithDefaults(requestOptions, 200, (err, body) => {
      if (err) {
        this.logger.error({ error: err, body }, 'Got error while trying to run playbook');
        return callback(err);
      }

      this.logger.trace({ body }, 'Formatting Playbooks Ran Request Results');

      callback(null, playbookId, body.name);
    });
  }

  // will try to convert to a number otherwise will return the value passed in
  safeToInt(value) {
    if (typeof value === 'number') return value;

    let parsed = parseInt(value);
    if (isNaN(parsed)) {
      this.logger.error({ value: value }, 'could not convert value to int');
      return value;
    }

    return parsed;
  }

  runPlaybookAgainstContainer(playbookId, containerId, callback) {
    this.logger.info(`Running playbook id ${playbookId} against container ${containerId}`);

    let requestOptions = {};
    requestOptions.url = this.options.host + '/rest/playbook_run';
    requestOptions.method = 'POST';
    requestOptions.body = {
      container_id: this.safeToInt(containerId),
      playbook_id: this.safeToInt(playbookId),
      scope: 'new',
      run: true
    };
    requestOptions.json = true;

    this.requestWithDefaults(requestOptions, 200, (err, body) => {
      if (err) {
        this.logger.error({ error: err, body: body }, 'Got error while trying to run playbook');
        return callback(err);
      }

      let id = body.playbook_run_id;

      async.retry(
        { times: 8, interval: 1000 },
        (done) => {
          requestOptions = ro.getRequestOptions(this.options);
          requestOptions.url = this.options.host + '/rest/playbook_run/' + id;

          this.requestWithDefaults(requestOptions, 200, (err, body) => {
            this.logger.trace({ err: err, body: body }, 'Polling playbook run status');

            if (err) return done(err, null);

            let status = body && body.status ? body.status : 'running';
            if (status === 'running') {
              // if the status is 'running', keep retrying
              done(status, body);
            } else {
              done(null, body);
            }
          });
        },
        (err, body) => {
          // If we had an actual HTTP request error treat is as such
          if (err && err !== 'running') {
            return callback({
              detail: 'There was an HTTP error checking the status of the playbook run',
              err: err
            });
          }

          if (err === 'running') {
            return callback(null, {
              detail: 'The playbook is still running.  Please check your Phantom dashboard for details.'
            });
          }

          if (body && (body.status === 'failed' || body.status === 'failure')) {
            return callback({
              error: body,
              detail: 'Playbook Run Failed',
              message: body.message[0] === '{' ? JSON.parse(body.message).message : body.message
            });
          }

          callback(null, {
            detail: 'Playbook Ran Successfully',
            result: body
          });
        }
      );
    });
  }
}

module.exports = Playbooks;
