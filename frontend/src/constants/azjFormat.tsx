import * as yup from "yup";

export const azjFormat = yup.object().shape({
  azulejo: yup.object().shape({
    version: yup.string().required(),
  }).required(),
  payload: yup.object().shape({
    playground: yup.object().shape({
      name: yup.string().required(),
      version: yup.string().required(),
      description: yup.string().required(),
    }).required(),
    reference: yup.object().shape({
      systemResolution: yup.object().shape({
        width: yup.number().required(),
        height: yup.number().required(),
      }).required(),
      gameResolution: yup.object().shape({
        width: yup.number().required(),
        height: yup.number().required(),
      }).required(),
      viewportScale: yup.number().required(),
      canvasPadding: yup.object().shape({
        left: yup.number().required(),
        right: yup.number().required(),
        top: yup.number().required(),
        bottom: yup.number().required(),
      }).required(),
      gridSize: yup.object().shape({
        width: yup.number().required(),
        height: yup.number().required(),
      }).required(),
      usingGrid: yup.boolean().required(),
      usingAutoAlign: yup.boolean().required(),
      magneticThreshold: yup.number().required(),
      adjacencyThreshold: yup.number().required(),
      ApplicationScale: yup.number().required(),
      ConsoleApplicationScale: yup.number().required(),
    }).required(),
    components: yup.array().of(
      yup.object().shape({
        key: yup.number().required(),
        version: yup.string().required(),
        description: yup.string().required(),
        support: yup.object().shape({
          translation: yup.object().shape({
            x: yup.boolean().required(),
            y: yup.boolean().required(),
            z: yup.boolean().required(),
          }).required(),
          scaling: yup.object().shape({
            x: yup.boolean().required(),
            y: yup.boolean().required(),
            z: yup.boolean().required(),
          }).required(),
          zOrdering: yup.boolean().required(),
          linking: yup.boolean().required(),
        }).required(),
      }).required()
    ).required(),
    transforms: yup.array().of(
      yup.object().shape({
        componentKey: yup.number().required(),
        desiredSize: yup.object().shape({
          width: yup.number().required(),
          height: yup.number().required(),
        }).required(),
        align: yup.string().required(),
        translate: yup.object().shape({
          x: yup.number().required(),
          y: yup.number().required(),
          z: yup.number().required(),
        }).required(),
        scale: yup.object().shape({
          x: yup.number().required(),
          y: yup.number().required(),
          z: yup.number().required(),
        }).required(),
        zOrder: yup.number().required(),
      }).required()
    ).required(),
  }).required(),
});