import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";
import { Cilium } from "./lib/cilium";
import { CertManager } from "./lib/cert-manager";
import { CertManagerCrds } from "./lib/cert-manager-crds";

const certManagerVersion = "v1.9.1";

export class CiliumChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    //TODO test is failing because cilium randomly generates certs for resources
    // define resources here
    new Cilium(this, "cilium");
  }
}

export class CertManagerChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // TODO sort out auth to gcp for dns challenges https://github.com/salrashid123/k8s_federation_with_gcp
    new CertManager(this, "cert-manager", {
      version: certManagerVersion,
    });
  }
}

export class CertManagerCrdsChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    new CertManagerCrds(this, "cert-manager", {
      version: certManagerVersion,
    });
  }
}

const app = new App();
const network = new CiliumChart(app, "cilium");
const certmanager = new CertManagerChart(app, "cert-manager");
const certmanagercrds = new CertManagerCrdsChart(app, "cert-manager-crds");
certmanager.addDependency(certmanagercrds);
network.addDependency(certmanager);
app.synth();
