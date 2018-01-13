polarity.export = PolarityComponent.extend({
    details: Ember.computed.alias('block.data.details'),
    tags: Ember.computed('block.data.details', function () {
        var details = this.get('block.data.details');

        return details.reduce(function (array, next) {
            return array.concat([
                next.severity,
                next.sensitivity
            ].concat(next.tags));
        }, []);
    })
});
