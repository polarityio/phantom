module.exports = {
  /**
   * Name of the integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @required
   */
  name: 'Phantom',
  /**
   * The acronym that appears in the notification window when information from this integration
   * is displayed.  Note that the acronym is included as part of each "tag" in the summary information
   * for the integration.  As a result, it is best to keep it to 4 or less characters.  The casing used
   * here will be carried forward into the notification window.
   *
   * @type String
   * @required
   */
  acronym: 'PH',
  /**
   * Description for this integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @optional
   */
  description: 'Phantom provides automation and security orchestration capabilities.',
  entityTypes: ['IPv4', 'hash', 'domain', 'email'],
  defaultColor: 'light-purple',
  /**
   * An array of style files (css or less) that will be included for your integration. Any styles specified in
   * the below files can be used in your custom template.
   *
   * @type Array
   * @optional
   */
  styles: ['./styles/phantom.less'],
  /**
   * Provide custom component logic and template for rendering the integration details block.  If you do not
   * provide a custom template and/or component then the integration will display data as a table of key value
   * pairs.
   *
   * @type Object
   * @optional
   */
  block: {
    component: {
      file: './components/phantom-block.js'
    },
    template: {
      file: './templates/phantom-block.hbs'
    }
  },
  onDemandOnly: true,
  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: '',
    /**
     * If set to false, the integration will ignore SSL errors.  This will allow the integration to connect
     * to the servers without valid SSL certificates.  Please note that we do NOT recommending setting this
     * to false in a production environment.
     */
    rejectUnauthorized: true
  },
  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'host',
      name: 'Server',
      description: 'The hostname of the Phantom server.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'token',
      name: 'Phantom API Token',
      description: 'Phantom API Token',
      default: '',
      type: 'password',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'playbookLabels',
      name: 'Playbook Labels',
      description:
        'A comma separated list of Playbook Labels used to determine which playbooks can be run on Indicators in Phantom. ' +
        'By adding labels, you make more Playbooks available for you to run. The default value is "events".',
      default: 'events',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'playbookRepoNames',
      name: 'Playbook Repository Names',
      description:
        'A comma separated list of Playbook Repository Names for Playbook Repositories you want to use. ' +
        'If left blank, all Playbooks from all Playbook Repositories with be available for use. ' +
        '(Must restart the integration for changes to take effect)',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'defaultSubmissionLabel',
      name: 'Default Submission Label',
      description:
        'This is the Default Label that is used on all Events and Artifacts that are submitted to Phantom. ' +
        "If left blank, the Event and Artifact Label will be the same as the Playbook's Label that was selected on Event creation.",
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'maxContainerResults',
      name: 'Max Container Results',
      description: 'Limits the amount of Containers that will show up when searching.',
      default: 10,
      type: 'number',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'showResultsWithLabels',
      name: 'Only Show Events with Playbook Labels',
      description: 'If checked, only Events that have one of your Playbook Labels listed will show up in the overlay.',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'compareLabels',
      name: 'Compare Playbook and Event Labels',
      description: 'If checked, only Playbooks that have the one of the labels on an Event will show up as possible Playbooks for you to run on that Event.',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'showCreateInDashboardLink',
      name: 'Display Dashboard Creation Link',
      description:
        'If unchecked, the link that says "Create Event in Phantom Dashboard" will not be displayed on overlay results for New Entity Submission.',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: false
    }
  ]
};
