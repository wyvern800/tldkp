import Ajv from "ajv";
const ajv = new Ajv();

const schemaAzj = {
  type: "object",
  properties: {
    azulejo: {
      type: "object",
      properties: {
        version: { type: "string" }
      },
      required: ["version"]
    },
    payload: {
      type: "object",
      properties: {
        playground: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            description: { type: "string" }
          },
          required: ["name", "version", "description"]
        },
        reference: {
          type: "object",
          properties: {
            systemResolution: {
              type: "object",
              properties: {
                width: { type: "number" },
                height: { type: "number" }
              },
              required: ["width", "height"]
            },
            gameResolution: {
              type: "object",
              properties: {
                width: { type: "number" },
                height: { type: "number" }
              },
              required: ["width", "height"]
            },
            viewportScale: { type: "number" },
            canvasPadding: {
              type: "object",
              properties: {
                left: { type: "number" },
                right: { type: "number" },
                top: { type: "number" },
                bottom: { type: "number" }
              },
              required: ["left", "right", "top", "bottom"]
            },
            gridSize: {
              type: "object",
              properties: {
                width: { type: "number" },
                height: { type: "number" }
              },
              required: ["width", "height"]
            },
            usingGrid: { type: "boolean" },
            usingAutoAlign: { type: "boolean" },
            magneticThreshold: { type: "number" },
            adjacencyThreshold: { type: "number" },
            ApplicationScale: { type: "number" },
            ConsoleApplicationScale: { type: "number" }
          },
          required: [
            "systemResolution",
            "gameResolution",
            "viewportScale",
            "canvasPadding",
            "gridSize",
            "usingGrid",
            "usingAutoAlign",
            "magneticThreshold",
            "adjacencyThreshold",
            "ApplicationScale",
            "ConsoleApplicationScale"
          ]
        },
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "number" },
              version: { type: "string" },
              description: { type: "string" },
              support: {
                type: "object",
                properties: {
                  translation: {
                    type: "object",
                    properties: {
                      x: { type: "boolean" },
                      y: { type: "boolean" },
                      z: { type: "boolean" }
                    },
                    required: ["x", "y", "z"]
                  },
                  scaling: {
                    type: "object",
                    properties: {
                      x: { type: "boolean" },
                      y: { type: "boolean" },
                      z: { type: "boolean" }
                    },
                    required: ["x", "y", "z"]
                  },
                  zOrdering: { type: "boolean" },
                  linking: { type: "boolean" }
                },
                required: ["translation", "scaling", "zOrdering", "linking"]
              }
            },
            required: ["key", "version", "description", "support"]
          }
        },
        transforms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              componentKey: { type: "number" },
              desiredSize: {
                type: "object",
                properties: {
                  width: { type: "number" },
                  height: { type: "number" }
                },
                required: ["width", "height"]
              },
              align: { type: "string" },
              translate: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  z: { type: "number" }
                },
                required: ["x", "y", "z"]
              },
              scale: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  z: { type: "number" }
                },
                required: ["x", "y", "z"]
              },
              zOrder: { type: "number" }
            },
            required: ["componentKey", "desiredSize", "align", "translate", "scale", "zOrder"]
          }
        }
      },
      required: ["playground", "reference", "components", "transforms"]
    }
  },
  required: ["azulejo", "payload"]
};

export const validatePostHud = ajv.compile(schemaAzj);