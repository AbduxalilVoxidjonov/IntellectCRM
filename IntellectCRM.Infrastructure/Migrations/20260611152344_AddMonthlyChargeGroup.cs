using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMonthlyChargeGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Per-guruh billing: MonthlyCharge endi guruhga bog'lanadi (har faol a'zolik uchun alohida
            // hisob qatori; guruhsiz o'quvchi uchun GroupId=null). Eski (StudentId, Month) unique indeks
            // (StudentId, GroupId, Month) ga almashtiriladi.
            migrationBuilder.DropIndex(
                name: "IX_MonthlyCharges_StudentId_Month",
                table: "MonthlyCharges");

            migrationBuilder.AddColumn<string>(
                name: "GroupId",
                table: "MonthlyCharges",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyCharges_StudentId_GroupId_Month",
                table: "MonthlyCharges",
                columns: new[] { "StudentId", "GroupId", "Month" },
                unique: true,
                filter: "[GroupId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MonthlyCharges_StudentId_GroupId_Month",
                table: "MonthlyCharges");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "MonthlyCharges");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyCharges_StudentId_Month",
                table: "MonthlyCharges",
                columns: new[] { "StudentId", "Month" },
                unique: true);
        }
    }
}
