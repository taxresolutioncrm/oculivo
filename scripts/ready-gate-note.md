# SignalWire readiness gate

The browser dialer now waits for the SignalWire client's `ready$` signal before dialing, with a bounded timeout and cleanup on failure. The closeout verifier checks that readiness occurs before `client.dial()`.
