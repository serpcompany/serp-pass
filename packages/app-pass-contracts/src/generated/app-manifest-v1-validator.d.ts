type ValidationError = {
  instancePath: string;
  message?: string;
};

type ManifestValidator = ((input: unknown) => boolean) & {
  errors?: ValidationError[] | null;
};

declare const validate: ManifestValidator;
export default validate;
