polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  containers: Ember.computed.alias('details.results'),
  actions: {
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
          self.setMessage(containerIndex, 'Error running playbook');
        });
    }
  },
  setMessage(containerIndex, msg){
    this.set(`containers.${containerIndex}.__message`, msg);
  },
  message: ''
});
