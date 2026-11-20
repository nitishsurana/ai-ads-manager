import { renderProblems, type Rendered } from "./assert-render";
import { LAYOUT_CASES } from "./layout-cases";
import {
  BASE_INPUTS,
  badgeLogo,
  colourLogo,
  darkLogo,
  renderFixture,
  SPECS,
} from "./render-cases";

type Report = (name: string, problems: string[]) => void;

export function layoutCases(report: Report) {
  for (const { name, run } of LAYOUT_CASES) {
    const problem = run();
    report(`layout: ${name}`, problem ? [problem] : []);
  }
}

export const LOGO_FIXTURE = {
  source: "header" as const,
  pngPath: "fx/logo.png",
  width: 260,
  height: 90,
  sourceUrl: null,
  text: null,
  textRead: null,
  colourClass: "one_colour" as const,
  colours: ["#222222"],
  transparent: true,
  headerBackground: "#ffffff",
  iconOnly: false,
  storeBrand: true,
  badge: false,
};

async function allProblems(inputs: typeof BASE_INPUTS, rendered: Rendered[]) {
  return (
    await Promise.all(rendered.map((one) => renderProblems(inputs, one)))
  ).flat();
}

export async function fixtureRenders(report: Report) {
  const cases = [
    {
      name: "render: no logo, nine variations",
      inputs: BASE_INPUTS,
      logo: null,
    },
    {
      name: "render: one-colour logo",
      inputs: { ...BASE_INPUTS, logo: LOGO_FIXTURE },
      logo: await darkLogo(),
    },
    {
      name: "render: multi-colour logo",
      inputs: {
        ...BASE_INPUTS,
        logo: {
          ...LOGO_FIXTURE,
          colourClass: "multi_colour" as const,
          colours: ["#ed288c", "#00afae"],
        },
      },
      logo: await colourLogo(),
    },
    {
      name: "render: badge logo",
      inputs: {
        ...BASE_INPUTS,
        logo: {
          ...LOGO_FIXTURE,
          width: 260,
          height: 260,
          colourClass: "multi_colour" as const,
          colours: ["#1a8f8a", "#ffffff"],
          badge: true,
        },
      },
      logo: await badgeLogo(),
    },
    {
      name: "render: wordmark, INR price",
      inputs: {
        ...BASE_INPUTS,
        values: {
          ...BASE_INPUTS.values,
          price: "1,299",
          wasPrice: null,
          currency: "INR",
        },
        logo: {
          ...LOGO_FIXTURE,
          source: "wordmark" as const,
          pngPath: null,
          text: "Acme Home",
        },
      },
      logo: null,
    },
  ];
  for (const { name, inputs, logo } of cases) {
    try {
      const rendered = await renderFixture(name, inputs, SPECS, logo);
      report(name, await allProblems(inputs, rendered));
    } catch (error) {
      report(name, [
        `threw: ${error instanceof Error ? error.message : error}`,
      ]);
    }
  }
}
