export const lgas = [
  "Agege",
  "Ajeromi-Ifelodun",
  "Alimosho",
  "Amuwo-Odofin",
  "Apapa",
  "Badagry",
  "Epe",
  "Eti-Osa",
  "Ibeju-Lekki",
  "Ifako-Ijaiye",
  "Ikeja",
  "Ikorodu",
  "Kosofe",
  "Lagos Island",
  "Lagos Mainland",
  "Mushin",
  "Ojo",
  "Oshodi-Isolo",
  "Shomolu",
  "Surulere",
];
export const pageNames = [
  "home",
  "shop",
  "categories",
  "brands",
  "deals",
  "wholesale",
  "contact",
  "cart",
  "checkout",
  "account",
  "track",
  "policy",
  "product",
  "admin",
];
export const defaults = {
  brand: "Liquor Plug",
  tagline: "A better pour.",
  whatsapp: "2348062833017",
  email: "",
  address: "",
  hours: "Contact us to confirm opening hours",
  primary: "#4E0707",
  background: "#000000",
  logo: "",
  font: "sans",
  ageCheck: true,
  pickupEnabled: false,
  pickupInstructions: "",
  wholesaleMinimum: 0,
  wholesaleQuantityEnabled: true,
  wholesaleValueEnabled: false,
  seoTitle: "Liquor Plug · A better pour",
  socialImage: "/social-card.svg",
  copy: {
    announcement: "Good company deserves a great pour.",
    shopTitle: "Find your next favourite.",
    dealsTitle: "A little more to celebrate.",
    categoriesTitle: "Choose your kind of occasion.",
    brandsTitle: "Find your favourite label.",
    cartTitle: "Your bag",
    checkoutTitle: "A great choice.",
    checkoutIntro: "Let’s get your order ready.",
    contactTitle: "Your next occasion starts here.",
    contactIntro:
      "Questions about a bottle, a bulk order or delivery? We’re a message away.",
    footerNote: "Good taste. Delivered with care.",
  },
  seoDescription:
    "Shop your next great pour. Drinks for every occasion, with retail and approved wholesale ordering in Lagos.",
  socials: { instagram: "", facebook: "" },
  navigation: [
    { label: "Shop", href: "/shop" },
    { label: "Categories", href: "/categories" },
    { label: "Brands", href: "/brands" },
    { label: "Wholesale", href: "/wholesale" },
  ],
  footerLinks: [
    { label: "Delivery", href: "/policy/delivery" },
    { label: "Returns", href: "/policy/returns" },
    { label: "Privacy", href: "/policy/privacy" },
  ],
  sections: [
    {
      type: "categories",
      title: "Find your kind of pour",
      subtitle: "A bottle for every taste. A little discovery in every visit.",
      visible: true,
    },
    {
      type: "featured",
      title: "The good stuff",
      subtitle: "Discover favourites for your next occasion.",
      visible: true,
    },
    {
      type: "wholesale",
      title: "Stock the bar. Set the standard.",
      subtitle:
        "Buying for a bar, restaurant or event? Apply for wholesale access.",
      visible: true,
    },
    {
      type: "brands",
      title: "Names you know. Taste you love.",
      subtitle: "Explore the labels behind your favourites.",
      visible: true,
    },
  ],
  banners: Object.fromEntries(
    pageNames.map((page) => [
      page,
      [
        {
          title:
            page === "home"
              ? "Good taste.\nGreat company."
              : page === "shop"
                ? "Your next great pour."
                : page === "wholesale"
                  ? "Better together.\nBetter by the case."
                  : "Something worth discovering.",
          subtitle:
            page === "home"
              ? "Discover a world of spirits, wines & a little something for every occasion."
              : "Explore Liquor Plug. Retail and wholesale drinks in Lagos.",
          image: "",
          mobileImage: "",
          button: "Explore the collection",
          href: "/shop",
          startsAt: 0,
          endsAt: 0,
        },
      ],
    ]),
  ),
  policies: {
    privacy:
      "We use your contact and delivery details to process orders and provide customer support. Contact the store for privacy requests. Update this policy with your business contact, data retention periods and service providers before launch.",
    delivery:
      "Delivery is available only to enabled areas. Fees and estimated times are shown at checkout. An adult must be available to receive alcohol; identification may be requested. Update this policy with your delivery commitments before launch.",
    returns:
      "Contact us promptly if your order arrives damaged or incorrect. Keep the packaging and order reference. Update this policy with your eligibility conditions, time limits and refund process before launch.",
    terms:
      "Alcohol purchases are restricted to adults aged 18 and above. Product availability is subject to confirmation. Please drink responsibly. Update these terms with your legal business details before launch.",
  },
};
