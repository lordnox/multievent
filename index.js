var EventEmitter = require('events').EventEmitter;
var slice = Array.prototype.slice;

/* Ugly ... Dirty Implementation of a multi-event-waiting
This extends the default EventEmitter.on to handle multible events.
Should be handled with care, can leak memory, because it buffers the results.

var EE = new EventEmitter();

EE.on('a', 'b', 'c', function() { console.log(arguments);});

setTimeout(function() { EE.emit('a', 'A');}, 100);
setTimeout(function() { EE.emit('b', 'B');}, 200);
setTimeout(function() { EE.emit('c', 'C');}, 300); // ['A', 'B', 'C']

setTimeout(function() { EE.emit('a', 'A1');}, 100);
setTimeout(function() { EE.emit('b', 'B1');}, 200);
setTimeout(function() { EE.emit('a', 'A2');}, 200);
setTimeout(function() { EE.emit('b', 'B2');}, 300);
setTimeout(function() { EE.emit('c', 'C1');}, 400); // ['A1', 'B1', 'C1']
setTimeout(function() { EE.emit('c', 'C2');}, 500); // ['A2', 'B2', 'C2']

Works with addListener and once too!
/**/
var multi = function(method) {
	return function(event, callback) {
		if(arguments.length <= 2) {
			// If this is an array of events we are waiting for, use multi recursivly
			if(event instanceof Array) {
				event.push(callback);
				return multi.apply(this, event);
			}
			// If our callback is another event create an eventhandler for it
			if(typeof callback === 'string')
				return method.call(this, event, function() {
					var args = slice.call(arguments);
					args.unshift(callback);
					this.emit.apply(this, args);
				});
			// call the 'normal' EventEmitter.on method
			return method.call(this, event, callback);
		}
		// We found multible events to wait for
		var events			= slice.call(arguments, 0, -1); 
		var callback		= slice.call(arguments, -1)[0]; // There should be only one...
		var self			= this;
		var result_stack	= {};	// Saves the results for later use
		var call_stack		= {};	// Saves the current position of the stacksize for this event
		// create an eventhandler for every event
		events.forEach(function(event, index) {
			call_stack[event]	= 0;	// init at 0
			result_stack[event]	= [];	// init at empty stack
			method.call(self, event, function() {
				// save all the 'results'
				var i = call_stack[event] ++;	// new emitted event + 1 stacksize
				result_stack[event][i] = slice.call(arguments);	// add the arguments to the result_stack
				var stack = events.map(function(ev) { // fetch all results and filter them
					return result_stack[ev][i];
				}).filter(function(item) { return !!item; });
				if(stack.length == events.length) { // if we have enough events saved, call the callback
					events.forEach(function(ev) { // but first
						result_stack[ev].shift();	// reduce the stack, we dont like memory leaks
						call_stack[ev]--;
					});
					callback.apply(self, stack); // call the event
				}
			});
		});
	};
};

// extend the on, once, and addListener methods
['addListener', 'on', 'once'].forEach(function(method) {
	EventEmitter.prototype[method]	= multi(EventEmitter.prototype[method]);
});