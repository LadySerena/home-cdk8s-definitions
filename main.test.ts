import { CiliumChart } from "./main";
import { Testing } from "cdk8s";

describe("Placeholder", () => {
  test("Empty", () => {
    const app = Testing.app();

    const cilium = new CiliumChart(app, "foo");
    const results = Testing.synth(cilium);

    expect(results).toMatchSnapshot();
  });
});
