import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";

import { SystemRbac } from "./lib/system-rbac";
import { MetricsServer } from "./lib/metrics-server";
import { PrometheusOperator } from "./lib/prometheus-operator";
import { PrometheusOperatorCrds } from "./lib/prometheus-operator-crds";
import { Monitoring } from "./lib/monitoring";
import { Metallb } from "./lib/metallb";
import { IngressNginx } from "./lib/ingress-nginx";
import { Cilium } from "./lib/cilium";
import { CertManager } from "./lib/cert-manager";
import { CertManagerCrds } from "./lib/cert-manager-crds";
import { CertificateAuthority } from "./lib/certificate-authority";

export class MyChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // define resources here

    new SystemRbac(this, "serena-rbac", {
      user: "serena",
      resourcePrefix: "tel",
    });
    new MetricsServer(this, "metrics-server", {});

    new PrometheusOperator(this, "prometheus-operator", {});

    new Monitoring(this, "serena-monitoring", {});

    new Metallb(this, "metallb", {});

    new IngressNginx(this, "nginx", {});

    const resourceNamespace = "certificate-authority";

    new CertManager(this, "cert-manager", {
      resourceNamespace: resourceNamespace,
    });

    new CertificateAuthority(this, "serena-ca", {
      namespace: resourceNamespace,
    });

    new Cilium(this, "cilium");


  }
}

export class PrometheusCrds extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    new PrometheusOperatorCrds(this, "prometheus-crds");
  }
}

export class CertManagerCrdInstall extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    new CertManagerCrds(this, "cert-manager-crds");
  }
}

const app = new App();
new MyChart(app, "home-kubernetes-js");
new PrometheusCrds(app, "prometheus-crds");
new CertManagerCrdInstall(app, "cert-manager-crds");
app.synth();
