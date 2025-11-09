/**
 * CommonJS TypeScript module to be required via createRequire
 */
const cjsMessage = "Hello from CommonJS TypeScript!";
const cjsValue = 123;

function greet(name: string): string {
  return `Hello, ${name} from CTS!`;
}

module.exports = {
  cjsMessage,
  cjsValue,
  greet,
};
