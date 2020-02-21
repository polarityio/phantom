polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  containers: Ember.computed.alias('details.results'),
  newEventMessage: '',
  newEventPlaybookId: null,
  timezone: Ember.computed('Intl', function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  actions: {
    changeTab: function(containerIndex, tabName) {
      this.set(`containers.${containerIndex}.__activeTab`, tabName);
    },
    runPlaybook: function(containerIndex, containerId, playbookId) {
      let self = this;
      self.set('message', null);

      if (!playbookId) {
        return this.setMessage(containerIndex, 'Select a playbook to run.');
      }

      console.info(`sending message with cont id ${containerId} and playbook id ${playbookId}`);

      this.sendIntegrationMessage({ data: { entity: this.block.entity, containerId, playbookId } })
        .then(function(/* response */) {
          self.setMessage(containerIndex, 'Success!');
        })
        .catch(function(err) {
          console.error(err);
          self.setMessage(containerIndex, err.message || err.title);
        });
    }
  },
  setMessage(containerIndex, msg) {
    if (containerIndex) {
      this.set(`containers.${containerIndex}.__message`, msg);
    } else {
      this.set('newEventMessage', msg);
    }
  }
});
