# LUSTRE · Car and bike detailing

A scroll site for a detailing studio. Scrolling plays a detail one layer at a time (arrive, foam, rinse, polish, coat), each stage wiping in over the last. Then you build your own package for a car or a bike and book it on WhatsApp.

"Lustre" is a demo brand. The address, phone number, prices and times are invented.

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Run it
```bash
python -m http.server 5182
```
Then open http://localhost:5182.

## Edit it
Everything you are likely to change is in `config.js`: the brand, the contact details, the vehicles, and each stage with its wipe effect, time and price.

## Media
`assets/stages/` holds one still per stage per vehicle, named `<vehicle>-<number>-<file>.jpg` (for example `car-2-foam.jpg`). All five stills of a vehicle must share one camera angle, because the page wipes from one to the next.

## Files
```
index.html      all sections
styles.css      all styles
config.js       all the content
app.js          the scroll film, package builder and booking
```
