import {Construct} from 'constructs';
import {App, Chart, ChartProps} from 'cdk8s';

import {SystemRbac} from "./lib/system-rbac";

export class MyChart extends Chart {
    constructor(scope: Construct, id: string, props: ChartProps = {}) {
        super(scope, id, props);

        // define resources here

        new SystemRbac(this, 'kat-rbac', {
           user: "kitty"
        });
    }

}

const app = new App();
new MyChart(app, 'home-kubernetes-js');
app.synth();
