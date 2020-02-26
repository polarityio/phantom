polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  containers: Ember.computed.alias('details.results'),
  onDemand: Ember.computed('block.entity.requestContext.requestType', function() {
    return this.block.entity.requestContext.requestType === 'OnDemand';
  }),
  newEventMessage: '',
  newEventPlaybookId: null,
  isRunning: false,
  timezone: Ember.computed('Intl', function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  actions: {
    changeTab: function(containerIndex, tabName) {
      this.set(`containers.${containerIndex}.__activeTab`, tabName);
    },
    runPlaybook: function(containerIndex, containerId, playbookId) {
      let self = this;

      //console.info(`runPlaybook index: ${containerIndex}, containerId: ${containerId}, playbookId: ${playbookId} `);

      if (!playbookId) return self.setMessage(containerIndex, 'Select a playbook to run.');

      this.setMessage(containerIndex, '');
      this.setRunning(containerIndex, true);
      this.get('block').notifyPropertyChange('data');

      self
        .sendIntegrationMessage({
          data: { entityValue: this.block.entity.value, containerId, playbookId }
        })
        .then(({ err, playbooksRan, playbooksRanCount, newContainer }) => {
          if (newContainer) {
            self.setContainer(newContainer);
            containerIndex = 0;
          } else {
            self.setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount);
          }

          if (err) {
            self.setMessage(containerIndex, `Run Failed: ${err.message || err.title}`);
          } else {
            self.setMessage(containerIndex, 'Successfully completed Playbook');
          }
        })
        .catch((err) => {
          self.setErrorMessage(containerIndex, err.message || err.title);
        })
        .finally(() => {
          self.setRunning(containerIndex, false);
          self.get('block').notifyPropertyChange('data');
        });
    }
  },

  setMessage(containerIndex, msg) {
    if (Number.isInteger(containerIndex)) {
      this.set(`containers.${containerIndex}.__message`, msg);
    } else {
      this.set('newEventMessage', msg);
    }
  },

  setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount) {
    this.set(`containers.${containerIndex}.playbooksRan`, playbooksRan);
    this.set(`containers.${containerIndex}.playbooksRanCount`, playbooksRanCount);
  },

  setContainer(newContainer) {
    this.set(`containers`, [newContainer]);
  },

  setErrorMessage(containerIndex, msg) {
    if (Number.isInteger(containerIndex)) {
      this.set(`containers.${containerIndex}.__errorMessage`, msg);
    } else {
      this.set('newEventErrorMessage', msg);
    }
  },

  setRunning(containerIndex, isRunning) {
    if (Number.isInteger(containerIndex)) {
      this.set(`containers.${containerIndex}.__running`, isRunning);
    } else {
      this.set('isRunning', isRunning);
    }
  }
});
