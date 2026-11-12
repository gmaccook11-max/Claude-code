# RE-Mind

A mobile app (installable web app) that keeps you on top of school and your day.

- **Daily checklist** that comes back every day, with streaks and an evening check-in that keeps nagging until everything is ticked.
- **My checklist** for things you need to schedule, with a reminder at the date and time you pick.
- **Assignments** with due dates, missing and late tracking, and import from a school calendar (.ics) feed.
- **Grades** per class with a goal, trend, and a flag when you fall below goal.
- **Report** page: streak, on-time rate, missing work, late log, grades below goal.

## Run it

No build step. The app lives in `public/`. Serve it over HTTP and open it:

```
python3 -m http.server 8000 --directory public
```

## School data

In Settings, choose "Connect a school calendar", pick Schoology, Canvas, Google Classroom or Other, and paste the calendar link from your school system. RE-Mind then syncs assignments each time it opens. Any system that can export an .ics file also works through "Import .ics file".

Most school sites block a web page from reading their calendar link directly, so the app falls back to a small relay at `api/feed` (`src/worker.js`). The relay runs when the app is hosted on Cloudflare Workers, which `wrangler.jsonc` sets up: connect the repository in the Cloudflare dashboard and it deploys with `npx wrangler deploy`. On hosts without it (such as GitHub Pages), use the file import.

Calendar links carry assignments and due dates only. Grades are entered by hand.

## Put it on a phone

Deploy to Cloudflare Workers as above (or host `public/` on any HTTPS static host), open the link, and choose "Add to Home Screen". All data stays on the device.
