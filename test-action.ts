import { fetchProjects } from './app/actions';
async function main() {
  const p = await fetchProjects();
  console.log(p);
}
main();
