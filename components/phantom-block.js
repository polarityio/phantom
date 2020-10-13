polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  containers: Ember.computed.alias('details.results'),
  onDemand: Ember.computed('block.entity.requestContext.requestType', function () {
    return this.block.entity.requestContext.requestType === 'OnDemand';
  }),
  possibleCefFields: Ember.computed.alias('details.possibleCefFields'),
  eventOwner: '',
  severity: 'low',
  sensitivity: 'white',
  newEventMessage: '',
  newEventPlaybookId: null,
  isRunning: false,
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  selectedCefField: [],
  selectedCefFields: [],
  editingCefFields: false,
  init() {
    this.set(
      'existingCefFields',
      (this.get('possibleCefFields') || []).map((orgTag) => ({
        name: orgTag
      }))
    );
    const users = this.get('details.users');

    this.set('eventOwner', users && users[0] && users[0].id);
    this._super(...arguments);
  },
  actions: {
    changeTab: function (containerIndex, tabName) {
      this.set(`containers.${containerIndex}.__activeTab`, tabName);
    },
    runPlaybook: function (containerIndex, containerId, playbookId) {
      let self = this;

      if (!playbookId) return self.setMessage(containerIndex, 'Select a playbook to run.');

      this.setMessage(containerIndex, '');
      self.setErrorMessage(containerIndex, '');
      this.setRunning(containerIndex, true);
      this.get('block').notifyPropertyChange('data');

      self
        .sendIntegrationMessage({
          data: {
            entityValue: self.block.entity.value,
            containerId,
            playbookId,
            playbooks: self.get('details.playbooks'),
            eventOwner: self.get('eventOwner'),
            severity: self.get('severity'),
            sensitivity: self.get('sensitivity'),
            submitCefFields: self.get('selectedCefFields').map((selectedCefField) => selectedCefField.name)
          }
        })
        .then(({ err, detail, playbooksRan, playbooksRanCount, newContainer }) => {
          if (newContainer) {
            self.setContainer(newContainer);
            containerIndex = 0;
          } else {
            self.setPlaybookRunHistory(containerIndex, playbooksRan, playbooksRanCount);
          }

          if (err) {
            self.setErrorMessage(containerIndex, `Run Failed: ${err.message || err.detail}`);
          } else {
            if (detail) {
              self.setMessage(containerIndex, detail);
            } else {
              self.setMessage(containerIndex, 'Successfully Run Playbook');
            }
          }
        })
        .catch((err) => {
          if (err.message === 'Integration Message Timout Error')
            return self.setErrorMessage(containerIndex, 'The playbook is taking longer than expect to complete');

          self.setErrorMessage(containerIndex, err.message);
        })
        .finally(() => {
          self.setRunning(containerIndex, false);
          self.get('block').notifyPropertyChange('data');
        });
    },

    editCefFields: function () {
      this.toggleProperty('editingCefFields');
      this.get('block').notifyPropertyChange('data');
    },

    deleteCefField: function (cefFieldToDelete) {
      this.set(
        'selectedCefFields',
        this.get('selectedCefFields').filter((selectedCefField) => selectedCefField.name !== cefFieldToDelete.name)
      );
      this.get('block').notifyPropertyChange('data');
    },

    searchCefFields: function (term) {
      const outerThis = this;
      return new Ember.RSVP.Promise((resolve, reject) => {
        if (term) {
          const cefFields = outerThis
            .get('possibleCefFields')
            .filter(
              (possibleCefField) =>
                possibleCefField.toLowerCase().includes(term.toLowerCase()) &&
                !this.selectedCefFields.some(
                  (_selectedCefField) =>
                    _selectedCefField.name.toLowerCase().trim() === possibleCefField.toLowerCase().trim()
                )
            )
            .map((possibleCefField) => ({ name: possibleCefField }));

          resolve([{ name: term, isNew: true }].concat(cefFields));
        } else {
          const existingCefFields = this.get('existingCefFields').filter(
            (existingCefField) =>
              !this.get('selectedCefFields').some(
                (_selectedCefField) =>
                  _selectedCefField.name.toLowerCase().trim() === existingCefField.name.toLowerCase().trim()
              )
          );
          this.set('existingCefFields', existingCefFields);
          this.get('block').notifyPropertyChange('data');

          resolve(existingCefFields);
        }
      });
    },

    addCefFields: function () {
      const selectedCefField = this.get('selectedCefField');
      const selectedCefFields = this.get('selectedCefFields');

      let newSelectedCefFields = selectedCefField
        .filter(
          (cefField) =>
            !selectedCefFields.some(
              (selectedCefField) => cefField.name.toLowerCase().trim() === selectedCefField.name.toLowerCase().trim()
            )
        )
        .map((cefField) => Object.assign({}, cefField, { name: cefField.name.split(' ').join('_') }));

      this.set('selectedCefFields', selectedCefFields.concat(newSelectedCefFields));
      this.set('selectedCefField', []);
      this.toggleProperty('editingCefFields');
      this.get('block').notifyPropertyChange('data');
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
