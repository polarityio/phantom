polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  containers: Ember.computed.alias('details.results'),
  message: '',
  timezone: Ember.computed('Intl', function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  actions: {
    changeTab: function(containerIndex, tabName) {
      this.set(`containers.${containerIndex}.__activeTab`, tabName);
    },
    runPlaybook: function(containerIndex, containerId, playbookId, entity) {
      let self = this;
      self.set('message', null);

      if(!playbookId){
        return this.setMessage(containerIndex, 'Select a playbook to run.');
      }

      console.info(`sending message with cont id ${containerId} and playbook id ${playbookId}`);

      this.sendIntegrationMessage({ data: { containerId, playbookId, entity } })
        .then(function(/* response */) {
          self.set('message', 'Success!');
          self.setMessage(containerIndex, 'Success!');
        })
        .catch(function(err) {
          console.error(err);
          self.setMessage(containerIndex, err.message || err.title);
        });
    }
  },
  setMessage(containerIndex, msg){
    this.set(`containers.${containerIndex}.__message`, msg);
  }
});
