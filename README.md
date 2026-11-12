# RE-Mind

A mobile app (installable web app) that keeps you on top of school and your day.

- **Daily checklist** that comes back every day, with streaks and an evening check-in that keeps nagging until everything is ticked.
- **My checklist** for things you need to schedule, with a reminder at the date and time you pick.
- **Assignments** with due dates, missing and late tracking, and import from a school calendar (.ics) feed.
- **Grades** per class with a goal, trend, and a flag when you fall below goal.
- **Report** page: streak, on-time rate, missing work, late log, grades below goal.

## Run it

No build step. Serve the folder over HTTP and open it:

```
python3 -m http.server 8000
```

To use it on a phone, host the folder on any HTTPS static host (for example GitHub Pages), open the link, and choose "Add to Home Screen". All data stays on the device.
