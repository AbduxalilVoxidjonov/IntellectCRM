import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, RootRedirect } from '@/components/auth/ProtectedRoute'
import { RequirePerm } from '@/components/auth/RequirePerm'
import { LoginPage } from '@/pages/LoginPage'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { LeadsPage } from '@/pages/admin/leads/LeadsPage'
import { CrmStatsPage } from '@/pages/admin/leads/CrmStatsPage'
import { StudentsPage } from '@/pages/admin/students/StudentsPage'
import { StudentEvaluationPage } from '@/pages/admin/students/StudentEvaluationPage'
import { EvaluationTypesPage } from '@/pages/admin/students/EvaluationTypesPage'
import { StudentDetailPage } from '@/pages/admin/students/StudentDetailPage'
import { StudentTurnstilePage } from '@/pages/admin/students/StudentTurnstilePage'
import { TeachersPage } from '@/pages/admin/teachers/TeachersPage'
import { TeacherAttendancePage } from '@/pages/admin/teachers/TeacherAttendancePage'
import { TeacherSalaryPage } from '@/pages/admin/teachers/TeacherSalaryPage'
import { ClassesPage } from '@/pages/admin/classes/ClassesPage'
import { ClassDetailPage } from '@/pages/admin/classes/ClassDetailPage'
import { BallarNazoratiPage } from '@/pages/admin/discipline/BallarNazoratiPage'
import { BallSabablarPage } from '@/pages/admin/discipline/BallSabablarPage'
import { TeacherReportsPage } from '@/pages/admin/teacher-reports/TeacherReportsPage'
import { ContractsPage } from '@/pages/admin/contracts/ContractsPage'
import { BranchesPage } from '@/pages/admin/branches/BranchesPage'
import { StaffPage } from '@/pages/admin/staff/StaffPage'
import { FeedbackPage } from '@/pages/admin/feedback/FeedbackPage'
import { SubjectsPage } from '@/pages/admin/subjects/SubjectsPage'
import { CurriculumEditorPage } from '@/pages/admin/subjects/CurriculumEditorPage'
import { ReasonsPage } from '@/pages/admin/reasons/ReasonsPage'
import { ArchivePage } from '@/pages/admin/archive/ArchivePage'
import { LevelTestsPage } from '@/pages/admin/level-tests/LevelTestsPage'
import { LevelTestEditorPage } from '@/pages/admin/level-tests/LevelTestEditorPage'
import { PublicTestPage } from '@/pages/public/PublicTestPage'
import { MessagesPage } from '@/pages/admin/messages/MessagesPage'
import { AssignmentsPage } from '@/pages/admin/assignments/AssignmentsPage'
import { AssignmentScoresPage } from '@/pages/admin/assignment-scores/AssignmentScoresPage'
import { LmsClassesPage } from '@/pages/admin/lms/LmsClassesPage'
import { LmsSubjectsPage } from '@/pages/admin/lms/LmsSubjectsPage'
import { LmsModulesPage } from '@/pages/admin/lms/LmsModulesPage'
import { LmsTopicsPage } from '@/pages/admin/lms/LmsTopicsPage'
import { LocationPage } from '@/pages/admin/locations/LocationPage'
import { CamerasPage } from '@/pages/admin/cameras/CamerasPage'
import { ParentsPage } from '@/pages/admin/parents/ParentsPage'
import { TeacherAppPage } from '@/pages/admin/parents/TeacherAppPage'
import { FinancePage } from '@/pages/admin/finance/FinancePage'
import { SettingsPage } from '@/pages/admin/settings/SettingsPage'
import { AccountPage } from '@/pages/admin/account/AccountPage'
// O'qituvchi portali (SPA ichida, /teacher/*)
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard'
import { TeacherGroupDetailPage } from '@/pages/teacher/groups/TeacherGroupDetailPage'
import { TeacherEvaluationPage } from '@/pages/teacher/evaluation/EvaluationPage'
import { TeacherAssignmentsPage } from '@/pages/teacher/assignments/AssignmentsPage'
import { TeacherLmsPage } from '@/pages/teacher/lms/TeacherLmsPage'
import { TeacherLmsSubjectPage } from '@/pages/teacher/lms/TeacherLmsSubjectPage'
import { TeacherMessagesPage } from '@/pages/teacher/messages/MessagesPage'
import { TeacherProfilePage } from '@/pages/teacher/TeacherProfilePage'
import { TeacherMobileLayout } from '@/components/layout/TeacherMobileLayout'

export default function App() {
  return (
    <Routes>
      {/* Ochiq sahifa */}
      <Route path="/login" element={<LoginPage />} />
      {/* Ommaviy daraja testi (autentifikatsiyasiz) — topshirilsa CRM'da lid bo'ladi */}
      <Route path="/test/:slug" element={<PublicTestPage />} />

      <Route path="/" element={<RootRedirect />} />

      {/* Administrator paneli */}
      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/admin" element={<AppLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="leads" element={<RequirePerm perm="leads"><LeadsPage /></RequirePerm>} />
          <Route path="crm-stats" element={<RequirePerm perm="leads"><CrmStatsPage /></RequirePerm>} />
          <Route path="students" element={<RequirePerm perm="students"><StudentsPage /></RequirePerm>} />
          <Route path="students/baholash" element={<RequirePerm perm="students"><StudentEvaluationPage /></RequirePerm>} />
          <Route path="students/baholash-turlari" element={<RequirePerm perm="students"><EvaluationTypesPage /></RequirePerm>} />
          <Route path="students/turniket" element={<RequirePerm perm="students"><StudentTurnstilePage /></RequirePerm>} />
          <Route path="students/:id" element={<RequirePerm perm="students"><StudentDetailPage /></RequirePerm>} />
          <Route path="teachers" element={<RequirePerm perm="teachers"><TeachersPage /></RequirePerm>} />
          <Route path="teachers/attendance" element={<RequirePerm perm="teachers"><TeacherAttendancePage /></RequirePerm>} />
          <Route path="classes" element={<RequirePerm perm="classes"><ClassesPage /></RequirePerm>} />
          <Route path="classes/:id" element={<RequirePerm perm="classes"><ClassDetailPage /></RequirePerm>} />
          <Route path="teachers/salary" element={<RequirePerm perm="teachers"><TeacherSalaryPage /></RequirePerm>} />
          <Route path="discipline" element={<RequirePerm perm="discipline"><BallarNazoratiPage /></RequirePerm>} />
          <Route path="discipline/reasons" element={<RequirePerm perm="discipline"><BallSabablarPage /></RequirePerm>} />
          <Route path="subjects" element={<RequirePerm perm="schedule"><SubjectsPage /></RequirePerm>} />
          <Route path="subjects/:id/curriculum" element={<RequirePerm perm="schedule"><CurriculumEditorPage /></RequirePerm>} />
          <Route path="reasons" element={<RequirePerm perm="settings"><ReasonsPage /></RequirePerm>} />
          <Route path="archive" element={<RequirePerm perm="settings"><ArchivePage /></RequirePerm>} />
          <Route path="level-tests" element={<RequirePerm perm="schedule"><LevelTestsPage /></RequirePerm>} />
          <Route path="level-tests/:id" element={<RequirePerm perm="schedule"><LevelTestEditorPage /></RequirePerm>} />
          <Route path="assignments" element={<RequirePerm perm="app"><AssignmentsPage /></RequirePerm>} />
          <Route path="assignment-scores" element={<RequirePerm perm="app"><AssignmentScoresPage /></RequirePerm>} />
          <Route path="lms" element={<RequirePerm perm="app"><LmsClassesPage /></RequirePerm>} />
          <Route path="lms/:classId" element={<RequirePerm perm="app"><LmsSubjectsPage /></RequirePerm>} />
          <Route path="lms/:classId/:subjectId" element={<RequirePerm perm="app"><LmsModulesPage /></RequirePerm>} />
          <Route path="lms/:classId/:subjectId/:moduleId" element={<RequirePerm perm="app"><LmsTopicsPage /></RequirePerm>} />
          <Route path="messages" element={<RequirePerm perm="messages"><MessagesPage /></RequirePerm>} />
          <Route path="teacher-reports" element={<RequirePerm perm="teacherReports"><TeacherReportsPage /></RequirePerm>} />
          <Route path="contracts" element={<RequirePerm perm="contracts"><ContractsPage /></RequirePerm>} />
          <Route path="locations" element={<RequirePerm perm="app"><LocationPage /></RequirePerm>} />
          <Route path="parents" element={<RequirePerm perm="app"><ParentsPage /></RequirePerm>} />
          <Route path="app/teachers" element={<RequirePerm perm="app"><TeacherAppPage /></RequirePerm>} />
          <Route path="finance" element={<RequirePerm perm="finance"><FinancePage /></RequirePerm>} />
          <Route path="settings" element={<Navigate to="/admin/settings/school" replace />} />
          <Route path="settings/:section" element={<RequirePerm perm="settings"><SettingsPage /></RequirePerm>} />
          <Route path="account" element={<AccountPage />} />

          {/* Boshqaruv */}
          <Route path="boshqaruv/cameras" element={<RequirePerm perm="cameras"><CamerasPage /></RequirePerm>} />
          <Route path="boshqaruv/staff" element={<RequirePerm perm="staff"><StaffPage /></RequirePerm>} />
          <Route path="boshqaruv/feedback" element={<RequirePerm perm="feedback"><FeedbackPage /></RequirePerm>} />
          {/* Rollar endi "Xodimlar va rollar" sahifasiga birlashtirildi */}
          <Route path="boshqaruv/roles" element={<Navigate to="/admin/boshqaruv/staff" replace />} />
          <Route element={<ProtectedRoute role="superadmin" />}>
            <Route path="boshqaruv/branches" element={<BranchesPage />} />
          </Route>
        </Route>
      </Route>

      {/* O'qituvchi portali — MOBIL ilova qobig'i (telefon, Flutter WebView orqali).
          Admin Sidebar/Topbar O'RNIGA pastki tab navigatsiya (TeacherMobileLayout). */}
      <Route element={<ProtectedRoute role="teacher" />}>
        <Route path="/teacher" element={<TeacherMobileLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="groups/:id" element={<RequirePerm perm="journal"><TeacherGroupDetailPage /></RequirePerm>} />
          <Route path="evaluation" element={<TeacherEvaluationPage />} />
          <Route path="assignments" element={<RequirePerm perm="assignments"><TeacherAssignmentsPage /></RequirePerm>} />
          <Route path="lms" element={<TeacherLmsPage />} />
          <Route path="lms/:subjectId" element={<TeacherLmsSubjectPage />} />
          <Route path="messages" element={<RequirePerm perm="messages"><TeacherMessagesPage /></RequirePerm>} />
          <Route path="profile" element={<TeacherProfilePage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
