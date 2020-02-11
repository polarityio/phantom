let playbookId;

polarity.export = PolarityComponent.extend({
    details: Ember.computed.alias('block.data.details'),
    actions: {
        runPlaybook: function (containerId, entity) {
            let self = this;
            self.set('message', null);

            console.log('sending message with cont id ' + containerId + ' play id' + playbookId);
            
            this.sendIntegrationMessage({ data: { containerId, playbookId, entity } })
                .then(function (/* response */) {
                    self.set('message', "Success!");
                }).catch(function (err) {
                    console.error(err);
                    self.set('message', "Error running playbook");
                });
        },
        onSelectPlaybook: function (value) {
            playbookId = value;
        }
    },
    message: ''
});
