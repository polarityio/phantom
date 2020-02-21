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
        .sendIntegrationMessage({
          data: { entityValue: this.get("details.entity"), containerId, playbookId }
        })
        .then(({ err, playbooksRan, playbooksRanCount, container }) => {
          if (container) self.setContainer(container);
          else
            self.setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount);

          if (err)
            self.setMessage(containerIndex, `Run Failed: ${err.message || err.title}`);
          else self.setMessage(containerIndex, "Success!");
        })
        .catch(function(err) {
          console.error(err);
          self.setMessage(containerIndex, err.message || err.title);
        });
    }
  },

  setMessage(containerIndex, msg) {
    this.set(`containers.${containerIndex || 0}.__message`, msg);
  },

  setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount) {
    this.set(`containers.${containerIndex}.playbooksRan`, playbooksRan);
    this.set(`containers.${containerIndex}.playbooksRanCount`, playbooksRanCount);
  },

  setContainer(container) {
    this.set(`containers`, [container]);
    this.set(`details.onDemand`, false);
  }
});
