'use strict';

describe('instant update with injected failures', function () {
    
  var fakeId, oldCollectionUpdate;

  beforeEach(function () {
    // Fake userId to get through tx userId checks
    fakeId = 'or6YSgs6nT8Bs5o6p';
    
    // Because `tx.requireUser = true` (by default)
    spyOn(Meteor,'userId').and.returnValue(fakeId);

    oldCollectionUpdate = Mongo.Collection.prototype.update;
    Mongo.Collection.prototype.update = function(sel, mod, opt, cb) {
      console.log("Reached monkeypatch", sel, mod, opt, cb);
      if (opt && !opt.tx && opt.injectFailure) {
        var f = function() { cb(new Error("injected failure")); };
        if (opt.injectFailure == "async") {
          // Simulate an asynchronous operation.
          Meteor.defer(f);
        } else {
          f();
        }
      } else {
        return oldCollectionUpdate.apply(this, arguments);
      }
    };
  });

  afterEach(function () {
    fooCollection.remove({});
    tx.Transactions.remove({});
    Mongo.Collection.prototype.update = oldCollectionUpdate;
  });
 
  it ('synchronous injected failure should propagate', function () {
    fooCollection.insert({_id: "myId"});
    tx.start();
    expect(fooCollection.update("myId", {$set: {a: 1}}, {tx: true, instant: true, injectFailure: "sync"})).toBe(false);
    tx.commit();
  });

  it ('asynchronous injected failure should propagate', function () {
    fooCollection.insert({_id: "myId"});
    tx.start();
    expect(fooCollection.update("myId", {$set: {a: 1}}, {tx: true, instant: true, injectFailure: "async"})).toBe(false);
    tx.commit();
  });

  it ('real failure should propagate', function () {
    fooCollection.insert({_id: "myId"});
    tx.start();
    expect(fooCollection.update("myId", {$noSuchSet: {a: 1}},
      {tx: true, instant: true, inverse: {command: "$noSuchUnset", data: {a: 1}}})).toBe(false);
    tx.commit();
  });

});
