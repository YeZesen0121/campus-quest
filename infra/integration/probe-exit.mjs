import assert from "node:assert/strict";

assert.deepEqual(process.argv.slice(2), ["first argument", "second", "-m", "integration", "-k", "one or two", "--flag=value", "7"]);
console.log("INTEGRATION_ARGUMENT_FORWARDING=PASS");
console.error("INTEGRATION_STDERR_CAPTURE=PASS");
process.exit(7);
