import Ember from 'ember';
import ApplicationRouteMixin
  from 'ember-simple-auth/mixins/application-route-mixin';

// TODO: DSS-6581 Create URL retrieval module
const appConfigUrl = '/config';

const {
  Route,
  run,
  get,
  $: { getJSON },
  inject: { service },
  testing
} = Ember;

export default Route.extend(ApplicationRouteMixin, {
  // Injected Ember#Service for the current user
  sessionUser: service('current-user'),

  /**
   * Metrics tracking service
   * @type {Ember.Service}
   */
  metrics: service(),

  /**
   * Attempt to load the current user
   * @returns {Promise}
   */
  beforeModel() {
    this._super(...arguments);

    return this._loadCurrentUser();
  },

  /**
   * Perform post model operations
   * @return {Promise}
   */
  afterModel() {
    this._super(...arguments);

    return this._setupMetricsTrackers();
  },

  /**
   * Augments sessionAuthenticated.
   * @override ApplicationRouteMixin.sessionAuthenticated
   */
  sessionAuthenticated() {
    this._super(...arguments);
    this._loadCurrentUser();
  },

  /**
   * __It reloads the Ember.js application__ by redirecting the browser
   * to the application's root URL so that all in-memory data (such as Ember
   * Data stores etc.) gets cleared.
   * @override ApplicationRouteMixin.sessionInvalidated
   * @link https://github.com/simplabs/ember-simple-auth/issues/1048
   */
  sessionInvalidated() {
    if (!testing) {
      window.location.replace('/');
    }
  },

  /**
   * Internal method to invoke the currentUser service's load method
   *   If an exception occurs during the load for the current user,
   *   invalidate the session.
   * @returns {Promise<T, V>|RSVP.Promise<any>|Ember.RSVP.Promise<any, any>|Promise.<T>}
   * @private
   */
  _loadCurrentUser() {
    return get(this, 'sessionUser')
      .load()
      .catch(() => get(this, 'session').invalidate());
  },

  /**
   * Requests app configuration props then if enabled, sets up metrics
   *   tracking using the supported trackers
   * @return {Promise.<TResult>}
   * @private
   */
  _setupMetricsTrackers() {
    // TODO: DSS-6813 Make this request for appConfig a singleton object
    return Promise.resolve(getJSON(appConfigUrl))
      .then(({ status, config = {} }) => {
        const { tracking = {} } = config;

        if (status === 'ok' && tracking.isEnabled) {
          const metrics = get(this, 'metrics');
          const { trackers = {} } = tracking;
          const {
            piwikSiteId,
            piwikUrl = '//piwik.corp.linkedin.com/piwik/'
          } = trackers.piwik;

          metrics.activateAdapters([{
            name: 'Piwik',
            environments: ['all'],
            config: {
              piwikUrl,
              siteId: piwikSiteId
            }
          }]);
        }
      });
  },

  init() {
    this._super(...arguments);
    run.scheduleOnce('afterRender', this, 'processLegacyDomOperations');
  },

  processLegacyDomOperations() {
    // TODO: DSS-6122 Refactor Remove tree legacy operations & references
    // window.legacySearch();
    // window.legacyTree();
    window.legacyMain();
  }
});
