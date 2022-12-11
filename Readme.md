"top" command for Node apps

The idea is to be able to quickly see the heaviest currently running Node functions using a single command in the terminal just like with "top" for regular processes. Another major point is only attaching the inspector for the time of the profiling so the tool can be always available in a production server without causing any overhead.

Once this is enabled there's no need to restart the app with "--profile" flag so any unexpected high CPU usage can be debugged more easily.

Usage
```bash
npm i ntop
```

Add to the script to enable communication with CLI tool
```javascript
const ntop = require('ntop')
ntop()
```

Then run the CLI. It will find all processes enabled for ntop communication
```bash
npx ntop
```

You'll see a list of ntop-enabled Node processes and their corresponding PIDs for convenience. Now you can see the list of functions for any process with
```bash
npx ntop 12345
```

Example output:

* (garbage collector)     | 11.703ms |
* utils.bulkPreparePacket | 1.53ms | file:///home/app/src/Utils.js:91:26
* (anonymous)             | 1.181ms | evalmachine.<anonymous>:3:14
* (anonymous)             | 1.126ms | file:///home/app/node_modules/lodash/lodash.js:1223:19

Custom sampling time 5s
```bash
npx ntop 12345 5000
```

Verbose output showing breadcrumbs i.e. to see what called `(anonymous)`
```bash
npx ntop 12345 5000 -v
```

Example output with "breadcrumbs":

* (garbage collector)     | 4.191ms |
* utils.bulkPreparePacket | 3.034ms | file:///home/app/src/Utils.js:91:26
 < prepareBulkData < (anonymous) < update < emit < update < processTick < (anonymous) < listOnTimeout < processTimers

* (anonymous)             | 2.574ms | evalmachine.<anonymous>:3:14
 < listOnTimeout < processTimers

* prepareBulkData         | 1.516ms | file:///home/app/src/controllers/Map.js:672:17
 < (anonymous) < update < emit < update < processTick < (anonymous) < listOnTimeout < processTimers

* hasCallback             | 1.141ms | file:///home/app/src/Scripting.js:271:13
 < update < emit < update < processTick < (anonymous) < listOnTimeout < processTimers


Experimental flame chart
```bash
npx ntop 12345 5000 -f
```

Flame chart:

- (root) 3056.191ms
-- processTimers 0.661ms
--- listOnTimeout 0.661ms
---- (anonymous function) 0.661ms
----- processTick 0.661ms
------ queueNextAction 0.661ms
------- setImmediate 0.661ms
-------- Immediate 0.661ms
--------- initAsyncResource 0.661ms
-- processTimers 1.305ms
--- listOnTimeout 1.305ms
---- (anonymous function) 1.305ms
----- processTick 1.305ms
------ update 1.305ms
------- emit 1.305ms
-------- update 1.305ms
--------- (anonymous function) 1.305ms
-- (garbage collector) 2.185ms
-- processTimers 1.118ms
--- listOnTimeout 1.118ms
---- (anonymous function) 1.118ms
----- processTick 1.118ms
------ update 1.118ms
------- emit 1.118ms
-------- update 1.118ms
--------- (anonymous function) 1.118ms
---------- prepareBulkData 1.118ms
----------- utils.bulkPreparePacket 1.118ms
-- processTimers 1.471ms
--- listOnTimeout 1.471ms
---- (anonymous function) 1.471ms
----- processTick 1.471ms
------ update 1.471ms
------- emit 1.471ms
-------- update 1.471ms
--------- (anonymous function) 1.471ms
---------- prepareBulkData 1.471ms
----------- utils.bulkPreparePacket 1.471ms
------------ preparePacket 1.471ms
