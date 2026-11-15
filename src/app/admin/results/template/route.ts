export async function GET() {
  const csv =
    'lerne_id,category,title,level,result,achieved_on,organiser,description,skill_areas,max_marks,score_maths,score_science,score_english,score_social_studies\n' +
    'LERNE-2026-00001,grand_test,Grand Test 2026,school,participation,2026-11-12,Lerne,Annual Grand Test,,100,78,85,72,80\n' +
    'LERNE-2026-00002,challenges,Innovation Challenge 2026,state,winner,2026-12-05,Lerne,Won the state round,innovation;leadership,,,,,\n'
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="lerne-program-results-template.csv"',
    },
  })
}
