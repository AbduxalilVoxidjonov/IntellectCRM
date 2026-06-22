using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'qituvchilar faollik hisoboti (admin): dars o'tyaptimi, baho qo'ymoqdami, mavzu/uy vazifa
/// bermoqdami.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("teacherReports")]
[Route("api/admin/teacher-reports")]
public class TeacherReportsController(AppDbContext db) : ControllerBase
{
    /// <summary>Barcha o'qituvchilar bo'yicha umumiy ko'rinish.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeacherReportRowDto>>> Overview()
        => await TeacherActivityReport.BuildOverviewAsync(db);

    /// <summary>Bitta o'qituvchining batafsil hisoboti (sinf/fan yoyilmasi).</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<TeacherReportDetailDto>> Detail(string id)
    {
        var dto = await TeacherActivityReport.BuildDetailAsync(db, id);
        return dto is null ? NotFound() : dto;
    }
}
