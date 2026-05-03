/**
 * Trimmed list of countries for the profile picker. Code is
 * ISO-3166 alpha-2; flag is the regional-indicator emoji pair.
 */

export type CountryEntry = { code: string; name: string; flag: string };

function flagFor(code: string): string {
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}

const RAW = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"],
  ["IE", "Ireland"], ["AU", "Australia"], ["NZ", "New Zealand"],
  ["DE", "Germany"], ["FR", "France"], ["IT", "Italy"], ["ES", "Spain"],
  ["PT", "Portugal"], ["NL", "Netherlands"], ["BE", "Belgium"],
  ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"],
  ["IS", "Iceland"], ["PL", "Poland"], ["CZ", "Czechia"], ["AT", "Austria"],
  ["CH", "Switzerland"], ["GR", "Greece"], ["HU", "Hungary"], ["RO", "Romania"],
  ["UA", "Ukraine"], ["TR", "Türkiye"], ["RU", "Russia"], ["IL", "Israel"],
  ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["EG", "Egypt"],
  ["ZA", "South Africa"], ["NG", "Nigeria"], ["KE", "Kenya"], ["MA", "Morocco"],
  ["BR", "Brazil"], ["AR", "Argentina"], ["CL", "Chile"], ["MX", "Mexico"],
  ["CO", "Colombia"], ["PE", "Peru"], ["VE", "Venezuela"],
  ["JP", "Japan"], ["KR", "South Korea"], ["CN", "China"], ["TW", "Taiwan"],
  ["HK", "Hong Kong"], ["SG", "Singapore"], ["MY", "Malaysia"],
  ["TH", "Thailand"], ["VN", "Vietnam"], ["ID", "Indonesia"], ["PH", "Philippines"],
  ["IN", "India"], ["PK", "Pakistan"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"]
];

export const COUNTRIES: CountryEntry[] = RAW.map(([code, name]) => ({
  code,
  name,
  flag: flagFor(code)
}));
