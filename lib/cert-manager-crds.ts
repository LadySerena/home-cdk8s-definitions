import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import { Include } from "cdk8s";

export interface CertManagerCrdProps {
  readonly labels?: { [key: string]: string };
  readonly version: string;
}

export class CertManagerCrds extends Construct {
  constructor(scope: Construct, id: string, props: CertManagerCrdProps) {
    super(scope, id);

    const version = props.version;
    const labels = props.labels || StandardLabels("cert-manager");
    labels["app.kubernetes.io/version"] = version;

    new Include(this, "cert-manager-crds", {
      url: `https://github.com/cert-manager/cert-manager/releases/download/${version}/cert-manager.crds.yaml`,
    });
  }
}
