import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import { KubeNamespace } from "../imports/k8s";
import { Certificate, CertificateSpecPrivateKeyAlgorithm, ClusterIssuer } from "../imports/cert-manager.io";

export interface CertificateAuthorityProps {
  readonly name?: string;
  readonly namespace?: string;
  readonly labels?: { [key: string]: string };
}

export class CertificateAuthority extends Construct {
  issuer: ClusterIssuer;

  constructor(scope: Construct, id: string, props: CertificateAuthorityProps) {
    super(scope, id);

    const standardLabels = StandardLabels("serena-ca");

    const name = props.name || "serena-ca";

    const namespace = props.namespace || "certificate-authority";

    const labels = props.labels || standardLabels;

    new KubeNamespace(this, "ca-namespace", {
      metadata: {
        name: namespace,
        labels: labels,
      },
    });

    const selfSignedIssuer = new ClusterIssuer(this, "bootstrap", {
      metadata: {
        name: "self-signed",
      },
      spec: {
        selfSigned: {},
      },
    });

    const secretName = "root-ca";

    new Certificate(this, "initial-ca", {
      metadata: {
        name: name,
        labels: labels,
        namespace: "cert-manager",
      },
      spec: {
        isCa: true,
        commonName: "home-ca-root",
        secretName: secretName,
        duration: "8766h",
        privateKey: {
          algorithm: CertificateSpecPrivateKeyAlgorithm.ECDSA,
          size: 256,
        },
        issuerRef: {
          name: selfSignedIssuer.name,
          kind: selfSignedIssuer.kind,
          group: selfSignedIssuer.apiGroup,
        },
        subject: {
          countries: ["US"],
          organizations: ["serena homelab"],
        },
      },
    });

    this.issuer = new ClusterIssuer(this, "ca-issuer", {
      metadata: {
        name: name,
        labels: labels,
        namespace: namespace,
      },
      spec: {
        ca: {
          secretName: secretName,
        },
      },
    });
  }
}
