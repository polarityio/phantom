polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias("block.data.details"),
  containers: Ember.computed.alias("details.results"),
  newEventMessage: "",
  newEventPlaybookId: null,
  timezone: Ember.computed("Intl", function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  actions: {
    changeTab: function(containerIndex, tabName) {
      this.set(`containers.${containerIndex}.__activeTab`, tabName);
    },
    runPlaybook: function(containerIndex, containerId, playbookId) {
      let self = this;

      if (!playbookId)
        return self.setMessage(containerIndex, "Select a playbook to run.");

      console.info(
        `sending message with cont id ${containerId} and playbook id ${playbookId}`
      );

      self
        .sendIntegrationMessage({ data: { containerId, playbookId, entity } })
        .then(({ err, playbooksRan, playbooksRanCount }) => {
          if (err)
            self.setMessage(containerIndex, `Run Failed: ${err.message || err.title}`);
          else self.setMessage(containerIndex, "Success!");

          self.setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount);
        })
        .catch(function(err) {
          console.error(err);
          self.setMessage(containerIndex, err.message || err.title);
        });
    }
  },
  setMessage(containerIndex, msg) {
    if (containerIndex) this.set(`containers.${containerIndex}.__message`, msg);
    else this.set("newEventMessage", msg);
  },
  setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount) {
    this.set(`containers.${containerIndex}.playbooksRan`, playbooksRan);
    this.set(`containers.${containerIndex}.playbooksRanCount`, playbooksRanCount);
  }
});
