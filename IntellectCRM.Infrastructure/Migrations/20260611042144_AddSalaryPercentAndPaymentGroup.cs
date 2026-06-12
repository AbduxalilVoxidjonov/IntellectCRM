using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSalaryPercentAndPaymentGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // O'qituvchi foizli maoshi (SalaryMode/SalaryPercent) + to'lovni guruhga teglash (FinanceTransactions.GroupId).
            migrationBuilder.AddColumn<string>(
                name: "SalaryMode",
                table: "Teachers",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "SalaryPercent",
                table: "Teachers",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "GroupId",
                table: "FinanceTransactions",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SalaryMode",
                table: "Teachers");

            migrationBuilder.DropColumn(
                name: "SalaryPercent",
                table: "Teachers");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "FinanceTransactions");
        }
    }
}
