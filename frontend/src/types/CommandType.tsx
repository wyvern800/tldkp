export interface CommandOptions {
  name: string,
  description: string,
  type?: unknown,
  required?: boolean,
}
export interface CommandType {
  name: string;
  description: string;
  options: CommandOptions[]
} 