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

Custom sampling time 5s
```bash
npx ntop 12345 5000
```

Verbose output showing breadcrumbs i.e. to see what called `(anonymous)`
```bash
npx ntop 12345 5000 -v
```

Experimental flame chart
```bash
npx ntop 12345 5000 -f
```
