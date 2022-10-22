import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";
import { Cilium } from "./lib/cilium";
import { CertManager } from "./lib/cert-manager";
import { CertManagerCrds } from "./lib/cert-manager-crds";
import { ClusterIssuer } from "./imports/cert-manager.io";
import { CertificateAuthority } from "./lib/certificate-authority";
import { KubeNamespace } from "./imports/k8s";

const certManagerVersion = "v1.9.1";

export class CiliumChart extends Chart {
  certManagerNamespace: KubeNamespace;

  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const certAuthority = new CertificateAuthority(this, "serena-ca", {
      namespace: "self-signed-ca",
    });

    const cilium = new Cilium(this, "cilium", {
      clusterIssuer: certAuthority.issuer,
      bootstrap: false,
    });

    this.certManagerNamespace = cilium.certManagerNamespace;
  }
}

export class CertManagerChart extends Chart {
  stagingIssuer: ClusterIssuer;
  productionIssuer: ClusterIssuer;

  constructor(scope: Construct, id: string, ns: KubeNamespace, props: ChartProps = {}) {
    super(scope, id, props);

    // TODO sort out auth to gcp for dns challenges https://github.com/salrashid123/k8s_federation_with_gcp
    // Ok this needs the control plane externally accessible
    const certManager = new CertManager(this, "cert-manager", {
      version: certManagerVersion,
      projectID: "telvanni-platform",
      serviceAccountSecret: "cloud-dns01-key",
      serviceAccountSecretKey: "key.json",
      namespace: ns,
    });
    this.stagingIssuer = certManager.stagingIssuer;
    this.productionIssuer = certManager.productionIssuer;
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
const certmanager = new CertManagerChart(app, "cert-manager", network.certManagerNamespace);

const certmanagercrds = new CertManagerCrdsChart(app, "cert-manager-crds");
certmanager.addDependency(certmanagercrds);
certmanager.addDependency(network);

app.synth();
