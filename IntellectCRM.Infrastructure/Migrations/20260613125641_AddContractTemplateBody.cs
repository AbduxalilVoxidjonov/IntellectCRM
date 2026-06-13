using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddContractTemplateBody : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Body",
                table: "ContractTemplates",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Body",
                table: "ContractTemplates");
        }
    }
}
