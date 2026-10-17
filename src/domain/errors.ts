// Base class so callers can catch every business-rule violation with one instanceof check.
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    // Report the concrete subclass name (e.g. "InvalidQuarterError") in logs and stack traces.
    this.name = new.target.name;
  }
}

export class InvalidQuarterError extends DomainError {}

export class InvalidPercentageError extends DomainError {}

export class InvalidVehicleCountError extends DomainError {}

export class InvalidSeedError extends DomainError {}

export class InvalidVehicleIdError extends DomainError {}

export class InvalidTenantIdError extends DomainError {}

export class UnsupportedAlgorithmVersionError extends DomainError {
  constructor(readonly algorithmVersion: string) {
    super(`Unsupported algorithm version: ${algorithmVersion}`);
  }
}

export class DuplicateVehicleError extends DomainError {
  constructor(readonly vehicleId: string) {
    super(`Duplicate vehicle id: ${vehicleId}`);
  }
}
