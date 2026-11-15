// Everything you are likely to change lives in this one file.
//
// DEMO CONTENT: the name, address, phone number, prices and times below are
// invented. Replace them before using this for a real business.
//
// Images: each stage needs one still per vehicle in assets/stages, named
//   <vehicle>-<number>-<file>.jpg      for example  car-2-foam.jpg, bike-5-coat.jpg
// (.png and .webp also work). All five stills of a vehicle must be taken from
// the same camera angle, because the page wipes from one to the next.
window.SHOP = {
  brand: "LUSTRE",
  line: "Car and bike detailing, Pune",
  whatsapp: "910000000000",          // country code + number, digits only
  phone: "+91 00000 00000",
  address: "Unit 4, Baner Road, Pune 411045",
  hours: "Tuesday to Sunday, 9 am to 8 pm",
  pickup: "Free pick-up and drop within 8 km",
  mediaFolder: "assets/stages",

  // "centre" is where the vehicle sits across its pictures, in percent from
  // the left; phones keep that point in view. "push" enlarges the picture from
  // its left edge on wide screens, which slides the vehicle to the right so the
  // job tag does not sit on top of it (1 = no change).
  vehicles: {
    car: { label: "Car", centre: 52, push: 1.12 },
    bike: { label: "Bike", centre: 62, push: 1 },
  },

  // The scroll film. "fx" is how this stage wipes in over the one before it:
  //   pour  = runs down from the top like foam
  //   jet   = swept across at an angle like a pressure washer
  //   pad   = opens out in a circle like a polishing pad
  //   flash = fades in under a moving band of light
  stages: [
    {
      id: "arrive",
      file: "dirty",
      rail: "Arrive",
      service: "Inspection",
      title: "Comes in rough.",
      text: "Monsoon mud, highway dust, last year's swirl marks. Bring it exactly as it is and we walk round it with you first.",
      time: "15 min",
      price: { car: 0, bike: 0 },
      included: true,
    },
    {
      id: "foam",
      file: "foam",
      fx: "pour",
      rail: "Foam",
      service: "Foam wash",
      title: "Buried in foam.",
      text: "Thick pH-neutral foam lifts the grit off the paint before a wash mitt ever touches it.",
      time: "40 min",
      price: { car: 699, bike: 299 },
      picked: true,
    },
    {
      id: "rinse",
      file: "rinse",
      fx: "jet",
      rail: "Rinse",
      service: "Decontamination",
      title: "Rinsed to bare paint.",
      text: "Clay and iron remover pull out what washing leaves behind, then a soft-towel dry by hand.",
      time: "1 hr",
      price: { car: 1299, bike: 499 },
    },
    {
      id: "polish",
      file: "polish",
      fx: "pad",
      rail: "Polish",
      service: "Machine polish",
      title: "The depth comes back.",
      text: "A two-step machine polish levels the fine scratches so the colour looks deep again.",
      time: "5 hr",
      price: { car: 5999, bike: 1999 },
    },
    {
      id: "coat",
      file: "coat",
      fx: "flash",
      rail: "Coat",
      service: "Ceramic coat",
      title: "Locked under glass.",
      text: "A ceramic coat seals the finish for three years. Water rolls straight off and dust has nothing to hold on to.",
      time: "1 day",
      price: { car: 18999, bike: 6999 },
    },
  ],
};
