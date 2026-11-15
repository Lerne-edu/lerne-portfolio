export async function GET() {
  const csv =
    'student_name,dob,grade,section,admission_no,parent1_name,parent1_mobile,parent2_name,parent2_mobile,parent_email,birth_cert_no,pen\n' +
    'Test Student,2012-05-10,8,A,1001,Test Parent,9000000000,Other Parent,9000000001,parent@example.com,,\n'
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="lerne-student-list-template.csv"',
    },
  })
}
