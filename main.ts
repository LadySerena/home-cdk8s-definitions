import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";

import { SystemRbac } from "./lib/system-rbac";
import { MetricsServer } from "./lib/metrics-server";

export class MyChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // define resources here

    new SystemRbac(this, "serena-rbac", {
      user: "serena",
      resourcePrefix: "tel",
    });
    new MetricsServer(this, "metrics-server", {});
  }
}

const app = new App();
new MyChart(app, "home-kubernetes-js");
app.synth();
