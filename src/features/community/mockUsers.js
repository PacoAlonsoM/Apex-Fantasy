// Shared mock identity data for community surfaces.
//
// `MOCK_PRO_USERS` is the source of truth for demo Pro accounts that appear
// in seeded Community content, Pro-League previews, and Grid seed posts.
// `MOCK_PRO_USERNAMES` is its username set — the cheaper lookup used to
// decorate posts/comments authored by these identities with Pro halos.
//
// Every entry uses a `support-*` `avatar_color` key, matching what real
// users pick in onboarding so every identity surface draws from one palette.

export const MOCK_PRO_USERS = [
  { id: "mock-pro-grid-racer-hk",   username: "grid_racer_hk",   avatar_color: "support-mclaren",  favorite_team: "McLaren",         points: 2420, subscription_status: "pro" },
  { id: "mock-pro-pitwall-pro",     username: "pitwall_pro",     avatar_color: "support-mercedes", favorite_team: "Mercedes",        points: 2195, subscription_status: "pro" },
  { id: "mock-pro-apexhunter-v",    username: "apexhunter_v",    avatar_color: "support-ferrari",  favorite_team: "Ferrari",         points: 1988, subscription_status: "pro" },
  { id: "mock-pro-tyre-whisperer",  username: "tyre_whisperer",  avatar_color: "support-williams", favorite_team: "Williams",        points: 1876, subscription_status: "pro" },
  { id: "mock-pro-overcut-king",    username: "overcut_king",    avatar_color: "support-alpine",   favorite_team: "Alpine",          points: 1754, subscription_status: "pro" },
  { id: "mock-pro-drs-zone-r",      username: "drs_zone_r",      avatar_color: "support-red-bull", favorite_team: "Red Bull Racing", points: 1612, subscription_status: "pro" },
  { id: "mock-pro-stint-veteran",   username: "stint_veteran",   avatar_color: "support-aston",    favorite_team: "Aston Martin",    points: 1540, subscription_status: "pro" },
  { id: "mock-pro-paddock-analyst", username: "paddock_analyst", avatar_color: "support-rb",       favorite_team: "Racing Bulls",    points: 1433, subscription_status: "pro" },
  { id: "mock-pro-lauda-line",      username: "lauda_line",      avatar_color: "support-haas",     favorite_team: "Haas",            points: 1381, subscription_status: "pro" },
  { id: "mock-pro-box-box-bella",   username: "box_box_bella",   avatar_color: "support-audi",     favorite_team: "Audi",            points: 1290, subscription_status: "pro" },
];

export const MOCK_PRO_USERNAMES = new Set(MOCK_PRO_USERS.map((profile) => profile.username));
