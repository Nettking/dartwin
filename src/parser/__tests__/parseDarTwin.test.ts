import { describe, expect, it } from "vitest";

import { parseDarTwin } from "../parseDarTwin";

const sample = `#dartwin StrawberryCultivationTrans {
  #twinsystem Strawberry {
    connect Strawberry.Cultivation.MultiSensor        to StrawberryDT.multisensor_input;
    connect StrawberryDT.actuator_output_irrigation   to Strawberry.Cultivation.IrrigationActuator;
    connect StrawberryDT.actuator_output_human        to Strawberry.Cultivation.HumanActuator;
    connect StrawberryDT.actuator_output_ventilation  to Strawberry.Cultivation.VentilationActuator;

    #digitaltwin StrawberryDT {
      port multisensor_input;
      port actuator_output_irrigation;
      port actuator_output_human;
      port actuator_output_ventilation;
    }

    part Cultivation {
      port MultiSensor;
      port IrrigationActuator;
      port HumanActuator;
      port VentilationActuator;
    }
  }

  #goal increase_yield { doc /* yield y higher y than before */ }
  #goal apply_decreased_water { doc /* water consumption w lower w than before */ }

  allocate increase_yield to Strawberry.StrawberryDT;
  allocate apply_decreased_water to Strawberry.StrawberryDT;
}`;

describe("parseDarTwin", () => {
  it("parses the sample DSL into a DarTwin model", () => {
    const model = parseDarTwin(sample);
    expect(model).toMatchInlineSnapshot(`
      {
        "allocations": [
          {
            "goal": "increase_yield",
            "target": "Strawberry.StrawberryDT",
          },
          {
            "goal": "apply_decreased_water",
            "target": "Strawberry.StrawberryDT",
          },
        ],
        "goals": [
          {
            "doc": "yield y higher y than before",
            "name": "increase_yield",
          },
          {
            "doc": "water consumption w lower w than before",
            "name": "apply_decreased_water",
          },
        ],
        "name": "StrawberryCultivationTrans",
        "systems": [
          {
            "connections": [
              {
                "from": "Strawberry.Cultivation.MultiSensor",
                "to": "StrawberryDT.multisensor_input",
              },
              {
                "from": "StrawberryDT.actuator_output_irrigation",
                "to": "Strawberry.Cultivation.IrrigationActuator",
              },
              {
                "from": "StrawberryDT.actuator_output_human",
                "to": "Strawberry.Cultivation.HumanActuator",
              },
              {
                "from": "StrawberryDT.actuator_output_ventilation",
                "to": "Strawberry.Cultivation.VentilationActuator",
              },
            ],
            "digital_twins": [
              {
                "name": "StrawberryDT",
                "ports": [
                  "multisensor_input",
                  "actuator_output_irrigation",
                  "actuator_output_human",
                  "actuator_output_ventilation",
                ],
              },
            ],
            "name": "Strawberry",
            "original_twins": [
              {
                "name": "Cultivation",
                "ports": [
                  "MultiSensor",
                  "IrrigationActuator",
                  "HumanActuator",
                  "VentilationActuator",
                ],
              },
            ],
          },
        ],
        "type": "DarTwin",
      }
    `);
  });

  it("captures connection names declared inline or via comment", () => {
    const withNames = `#dartwin Test {
      #twinsystem Alpha {
        #digitaltwin DT {
          port out;
        }

        part Machine {
          port input;
        }

        connect DT.out to Machine.input name inlineName;
        connect Machine.input to DT.out; // name: commentName
      }
    }`;

    const model = parseDarTwin(withNames);
    expect(model.systems[0]?.connections).toEqual([
      { from: "DT.out", to: "Machine.input", name: "inlineName" },
      { from: "Machine.input", to: "DT.out", name: "commentName" },
    ]);
  });
});
